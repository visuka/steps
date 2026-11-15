# Walk buddies — design (T16-0)

Written by Opus on 15 Nov 2026 from the owner's T16 decisions in `docs/current-task.md` (decisions 1–7 and the Opus rules), the `stepsinfra` code and this repo. Sonnet builds from this file without making design decisions. Where something is still the owner's call, it is in section 11 with the default used here; build the default.

Contents: 0 Summary · 1 Data · 2 API · 3 Chat delivery · 4 Push · 5 Moderation · 6 Privacy and safety · 7 Screens · 8 App code · 9 Tests · 10 Tasks · 11 Owner questions and risks.

## 0. Summary of the main choices

| Topic | Choice |
|---|---|
| Table | One new table `steps-social` (single-table), 2 GSIs, TTL `expiresAt`. Nothing new in `steps-user-data`. |
| Server code | One new Python Lambda `steps-social` behind the existing `steps-api` and authorizer; one new `steps-social-cron` (every 15 min). |
| Public identity | Other people see a random `pid` and the handle, never the account `sub`. |
| Chat | REST polling (4 s while a chat is open, push to wake). No WebSocket for now. |
| Push | Expo push service over FCM V1. Sent from `steps-social`. Six switches. |
| Owner tools | A command-line script `scripts/moderate.py` run with the owner's AWS login. No admin web route. New-report alert = a push to the owner's own phone. |
| Filter | Server-side: no links, emails or phone numbers; a word list kept in SSM (not in the public repos). |
| Location | The phone turns its coarse position into a geohash-5 code and sends only that code, at most once a day, only while "Show me" is on. |
| Family steps | Off until each member turns it on (store rules; see 6.4). |
| Premium | All of Walk buddies is premium by default (owner question 1). Report, block, leave and delete always work. |
| Deletion | `DELETE /v1/me` also erases all Walk buddies data. Reports, bans and a small sign-up record are kept 180 days (IT Rules), as the privacy policy will say. |

## 1. Data model

### 1.1 Why a new table

`steps-social` is new, not part of `steps-user-data`:

- Most items here are shared between people (buddy pairs, chats, clubs, families, plans). `steps-user-data` holds only one person's own items and is erased by a simple partition delete.
- It needs GSIs (pid lookup, club search, open reports). Adding GSIs to `steps-user-data` would touch the live table that the lake stream reads.
- Its stream would carry chat traffic; `steps-user-data` streams to the lake. `steps-social` has **no stream**.
- Separate IAM: only `steps-social`, `steps-social-cron` and `steps-data` (for erase) can touch it.

Settings, like the other tables (`stacks/data_stack.py`): `TableV2`, `PK` (S) + `SK` (S), on-demand, RETAIN, PITR, deletion protection, TTL attribute `expiresAt` (epoch seconds). New `TableConfig` entry `social_table = "steps-social"` in `config/config.py`.

GSIs (sparse: only items that carry the attributes are indexed; `INCLUDE` projection so a change to any other attribute does not rewrite the index):

| Index | Partition | Sort | Projection (`INCLUDE`) | Used for |
|---|---|---|---|---|
| `g1` | `g1pk` (S) | `g1sk` (S) | `pid`, `handle`, `name`, `banned`, `area`, `memberCount`, `hidden`, `kind`, `reason`, `dueAt`, `status` | pid → walker; club name search; open reports (moderate.py GetItems the full report) |
| `g2` | `g2pk` (S) | `g2sk` (S) | `name`, `area`, `memberCount`, `hidden` | club area search |

### 1.2 Key words

- `<sub>`: the account id from the token (UUIDv4). Stored only in keys and server fields; never returned to another person.
- `<pid>`: public walker id, 12 characters of Crockford base32 from `secrets.token_bytes`. Made once at join.
- `<cid>` chat key: `b.<sha256(subA + ":" + subB)[:24]>` for a buddy pair (subs sorted), `c.<clubId>`, `f.<famId>`. In the API a buddy chat is addressed as `b.<pid>` (the other person's pid); the server turns it into the hashed key.
- `<clubId>`, `<famId>`, `<planId>`, `<postId>`, `<rid>`: 12-character base32 random ids. `<msgId>`: a ULID (time-ordered).
- `<day>`: `YYYY-MM-DD` in the person's own time zone (sent by the phone). `<ts>`: epoch ms.
- All text attributes go through `#names` in expressions (reserved words), as in `store.mjs`.

### 1.3 Items

Walker (person):

| Item | PK | SK | Attributes | TTL |
|---|---|---|---|---|
| Profile | `W#<sub>` | `PROFILE` | `pid`, `handle` (as typed), `handleLower`, `handleChangedAt`, `name` (≤40, the name shown to buddies), `adultConfirmedOn` (`YYYY-MM-DD` only), `termsVersion`, `termsOn` (`YYYY-MM-DD`), `createdAt`, `area` (geohash-5 or absent), `areaSetOn` (`<day>`), `areaKey` (the nearby SK), `notify` (map, 2.3), `banned` (bool), `buddyCount`, `clubCount`, `foundedCount`, `g1pk`=`PID#<pid>`, `g1sk`=`W` | — |
| Handle claim | `HANDLE#<handleLower>` | `HANDLE` | `sub`, `pid` | — |
| Nearby entry | `AREA#<geohash5>` | `R#<4 random base32>#<sub>` (new prefix on each daily refresh; copied to the profile as `areaKey`) | `pid`, `setOn` | +8 days, renewed by each daily refresh |
| Buddy | `W#<sub>` | `BUDDY#<otherSub>` | `pid` (theirs), `since` | — |
| Request in | `W#<toSub>` | `REQIN#<fromSub>` | `pid` (sender), `at` | +30 days |
| Request out | `W#<fromSub>` | `REQOUT#<toSub>` | `pid` (receiver), `at`, `declined` (bool, never returned) | +30 days |
| Hide (block) | `W#<sub>` | `HIDE#<otherSub>` | `pid`, `byMe` (bool), `byThem` (bool) | — |
| Inbox row (buddy chats only) | `W#<sub>` | `INBOX#<cid>` | `pid` (other), `lastAt`, `lastMine` (bool), `lastText` (first 80 chars), `unread` (number) | — |
| Post (shared walk) | `W#<sub>` | `POST#<day>#<postId>` | `postId`, `activity` (`walk`/`ride`), `day`, `distanceM`, `movingS`, `steps` (number or null), `at` | — |
| Shared steps | `W#<sub>` | `SHARE#STEPS` | `day`, `steps`, `weekStart` (`<day>` of Monday), `weekSteps`, `tz` (IANA), `at` | +15 days |
| Push token | `W#<sub>` | `PUSH#<sha256(token)[:16]>` | `token`, `platform`, `at` | +60 days, renewed on each app start |
| Counter | `W#<sub>` | `LIMIT#<kind>#<day or minute>` | `count` | +2 days (day) / +2 min (minute) |
| Sent dedupe | `W#<sub>` | `SENT#<clientId>` | `msgId`, `cid` | +1 day |
| Push gate (buddy chats) | `W#<sub>` | `GATE#<cid>` | — | +60 s |
| Wrote in a group | `W#<sub>` | `WROTE#<cid>` (`c.`/`f.` only) | — (written with the first message to that chat; kept after leaving) | — |
| My clubs | `W#<sub>` | `CLUB#<clubId>` | `role`, `name` (copy) | — |
| My join request | `W#<sub>` | `JOINOUT#<clubId>` | `at` | +14 days |
| Declined by club | `W#<sub>` | `JOINNO#<clubId>` | — | +30 days |
| Club invite to me | `W#<sub>` | `CLUBINV#<clubId>` | `byPid`, `at` | +14 days |
| My family (one at most) | `W#<sub>` | `FAMILY` | `famId`, `role` | — |
| My plans | `W#<sub>` | `PLAN#<startsAt>#<planId>` | `role` (`organiser`/`invited`) | startsAt + 7 days |

Shared items:

| Item | PK | SK | Attributes | TTL |
|---|---|---|---|---|
| Message | `CHAT#<cid>` | `MSG#<msgId>` | `from` (sub), `fromPid`, `text` (≤500), `at`, `clientId` | buddy chat +365 days; club and family +180 days |
| Club | `CLUB#<clubId>` | `META` | `name` (3–40), `nameLower`, `area` (≤40, typed), `areaLower`, `about` (≤200), `hidden` (bool), `ownerSub`, `memberCount`, `createdAt`; when not hidden also `g1pk`=`CLUBS`, `g1sk`=`<nameLower>#<clubId>`, `g2pk`=`CLUBAREA#<first word of areaLower>`, `g2sk`=`<nameLower>#<clubId>` | — |
| Group last message | `CLUB#<clubId>` or `FAM#<famId>` | `LAST` | `lastMsgAt` (no g1/g2 keys; written with each group message) | — |
| Group push gate | `CLUB#<clubId>` or `FAM#<famId>` | `GATE` | — (one message push per group chat per 60 s) | +60 s |
| Club member | `CLUB#<clubId>` | `MEM#<sub>` | `pid`, `role` (`owner`/`admin`/`member`), `joinedAt`, `board` (bool), `readUpTo` (msgId), `push` (bool, copy of `notify.clubChat`, set at join and on PATCH `/me`) | — |
| Join request | `CLUB#<clubId>` | `JOINREQ#<sub>` | `pid`, `at` | +14 days |
| Club invite | `CLUB#<clubId>` | `INVITE#<sub>` | `pid`, `bySub`, `at` | +14 days |
| Club report pointer | `CLUB#<clubId>` | `REPORT#<rid>` | `at`, `status` | +180 days |
| Family | `FAM#<famId>` | `META` | `name` (≤40), `ownerSub`, `memberCount`, `code`, `createdAt` | — |
| Family member | `FAM#<famId>` | `MEM#<sub>` | `pid`, `role` (`owner`/`member`), `joinedAt`, `share` (bool, default false), `alertBy` (`HH:MM` or absent), `readUpTo`, `push` (bool, copy of `notify.family`) | — |
| Invite code | `CODE#<code>` | `CODE` | `famId` | +48 h |
| Cheer | `FAM#<famId>` | `CHEER#<ts>#<fromSub>` | `toSub`, `fromPid`, `toPid` | +7 days |
| Alert slot | `ALERT#<HHMM UTC, quarter hour>` | `<famId>#<sub>` | `localBy` (`HH:MM`), `tz`, `lastSentDay` | — |
| Plan | `PLAN#<planId>` | `META` | `organiserSub`, `organiserPid`, `clubId` (or absent), `startsAt` (ms), `tz`, `place` (≤60), `note` (≤200), `status` (`on`/`cancelled`), `updatedAt` | startsAt + 7 days |
| Plan invitee | `PLAN#<planId>` | `INV#<sub>` | `pid`, `answer` (`none`/`going`/`not_going`) | startsAt + 7 days |
| Club plan link | `CLUB#<clubId>` | `PLAN#<startsAt>#<planId>` | — | startsAt + 7 days |
| Report | `REPORT#<rid>` | `REPORT` | `reporterSub`, `targetSub`, `kind`, `ref`, `reason`, `note` (≤300), `snapshot` (map: text, handle, name, clubName …, copied at report time), `at`, `dueAt`, `status` (`open`/`removed`/`dismissed`/`banned`), `closedAt`, `g1pk`=`REPORTS#<status>`, `g1sk`=`<at>` | set to closedAt + 180 days on close; none while open |
| Ban | `BAN#<sub>` | `BAN` | `at`, `reason`, `rid` | none while the account exists; `DELETE /v1/me` sets +180 days |
| Sign-up record | `GONE#<sub>` | `GONE` | `pid`, `handle`, `name`, `createdAt`, `adultConfirmedOn`, `erasedAt` (IT Rules 3(1)(h); read only by `moderate.py`) | erasedAt + 180 days |
| Sweep job | `SWEEP#<id>` | `JOB` | `partitions` (whole `CHAT#<cid>` / `CLUB#<clubId>` / `FAM#<famId>` partitions still to delete), `authored` (`c.`/`f.` keys and the `sub` whose messages to delete), `at` | +7 days |

Notes:

- Handles: 3–20 characters, `^[A-Za-z0-9_]{3,20}$`, unique by `handleLower`. Reserved words list in code (`admin`, `steps`, `neutcrafts`, `support`, `moderator`, `official`). A change frees the old claim and sets `handleChangedAt`; another change before 30 days is refused.
- The 18+ answer is stored only as `adultConfirmedOn` (a date). No birth date, no age.
- No item ever holds latitude or longitude.
- **TTL is only clean-up** (DynamoDB deletes expired items up to days late). Every read, count and condition treats an item with `expiresAt <= now` as absent: conditional puts use `attribute_not_exists(SK) OR expiresAt < :now` (`GATE`, `GATE#`, `SENT#`, counters); GetItem checks (`CODE#`, `JOINNO#`, `CLUBINV#`, `INVITE#`, `JOINREQ#`, `REQIN#`/`REQOUT#`) compare `expiresAt`; queries and counts (`REQOUT#`, `JOINOUT#`, `AREA#`, `PLAN#`) add `FilterExpression expiresAt > :now`. moto tests write items already past `expiresAt` and expect them ignored.

### 1.4 Access patterns

| # | Pattern | How |
|---|---|---|
| A1 | My profile | GetItem `W#<sub>`/`PROFILE` |
| A2 | Walker by handle | GetItem `HANDLE#<lower>` → GetItem profile |
| A3 | Walker by pid | Query `g1` `g1pk = PID#<pid>` |
| A4 | Nearby | For my cell and its 8 neighbours: Query `AREA#<cell>` `SK >= R#<random>`, `FilterExpression expiresAt > :now`, Limit 20; wrap around from `R#` if short; page until 20 usable entries or 2 pages |
| A5 | My buddies / requests / blocks / clubs / plans / inbox / group writes | Query `W#<sub>` with `begins_with(SK, "BUDDY#" / "REQIN#" / "REQOUT#" / "HIDE#" / "CLUB#" / "PLAN#" / "INBOX#" / "WROTE#")`; family: GetItem `W#<sub>`/`FAMILY` |
| A6 | Buddy names | BatchGetItem profiles (100 per call) |
| A7 | Is X my buddy / is either blocked | GetItem `W#<me>`/`BUDDY#<x>`; GetItem `W#<me>`/`HIDE#<x>` |
| A8 | Messages after / before | Query `CHAT#<cid>`, `SK > MSG#<after>` (ascending) or `SK < MSG#<before>` (descending), Limit 50 |
| A9 | A buddy's posts | Query `W#<buddySub>` `begins_with(SK, "POST#")`, descending, Limit 20 |
| A10 | Club members, requests, invites, plans | Query `CLUB#<id>` by prefix `MEM#`, `JOINREQ#`, `INVITE#`, `PLAN#` |
| A11 | Club search by name | Query `g1` `g1pk = CLUBS`, `begins_with(g1sk, <q lower>)`, Limit 20 |
| A12 | Club search by area | Query `g2` `g2pk = CLUBAREA#<first word>`, Limit 20 |
| A13 | Weekly board | A10 members where `board`, then BatchGetItem `SHARE#STEPS` |
| A14 | Family and today's steps | Query `FAM#<id>`, then BatchGetItem `SHARE#STEPS` of members with `share` |
| A15 | Join family by code | GetItem `CODE#<code>` |
| A16 | Alerts due | Query `ALERT#<slot>` (cron) |
| A17 | Open reports, oldest first | Query `g1` `g1pk = REPORTS#open` |
| A18 | Counters | UpdateItem `ADD count :1` with `count < :max` condition (copy `ddb.take_daily`) |

## 2. API

### 2.1 Pattern

- All routes are on the existing `steps-api` HTTP API with the default token authorizer (`stacks/api_stack.py`). Identity is `http.caller(event)` → `sub`. No route takes a `sub`.
- One Lambda `steps-social`: `self._function("Social", "steps-social", handler="steps.social.handler.main", memory_size=256, timeout=Duration.seconds(10))`, dispatch on `event["routeKey"]` like `steps/data/handler.py`.
- Body helpers: `http.json_body` (cap 8 KB), `http.reply`, `http.BadRequest`. Errors are `{"error": "<code>"}`.
- Every route except `GET /v1/social/me` and `POST /v1/social/join` first loads the profile (A1):
  - no profile → 409 `not_joined`;
  - `banned` → 403 `banned` (except DELETE routes, blocks, reports and `GET /v1/social/me`).
- `POST /v1/social/join` first does GetItem `BAN#<sub>`/`BAN`; if it exists → 403 `banned` (a banned person who leaves cannot join again).
- Premium (2.4) is checked after the profile.
- Every write of text goes through the filter (5.5).
- Responses about people always use this shape (`Walker`): `{"pid", "handle", "name", "relation"}` with `relation` one of `none`, `buddy`, `requested` (I asked), `asked_me`, `self`. `name` is `null` for `none` and `requested` (strangers see the handle only); only `buddy`, `asked_me` and `self` carry it. Club member lists, club chat senders and plan lists use the same rule; family lists show names.
- Every accept or join is one TransactWriteItems (2.5 "Transactions"); `TransactionCanceled` reasons map to `already`, `club_full`, `family_full`, `buddy_limit`, `club_limit`, `in_family`.
- Times in responses are epoch ms. Lists are capped; pages use `before`/`after` ids.

### 2.2 Errors (shared)

| Status | Code | When |
|---|---|---|
| 400 | `bad_request` | missing or wrong field |
| 401 | `unauthorized` | no caller (authorizer passed but no sub) |
| 402 | `premium_required` | not premium (2.4) |
| 403 | `banned` / `forbidden` | banned / not allowed (not admin, not a member, not a buddy) |
| 404 | `not_found` | also for blocked people, banned people and hidden clubs, so nothing leaks |
| 409 | `not_joined`, `already`, `conflict` | state does not allow it |
| 413 | `too_large` | body over 8 KB |
| 422 | `text_not_allowed`, `handle_invalid`, `handle_taken`, `handle_too_soon`, `adult_required`, `terms_required` | content checks |
| 429 | `daily_limit`, `open_limit`, `rate_limited`, `join_limit`, `declined_recently` | limits |
| 503 | `unavailable` | premium list or word list unreadable, DynamoDB throttled |

### 2.3 Limits

| Limit | Value | Where |
|---|---|---|
| Message length | 500 characters (after trim; empty refused) | chat |
| Messages | 30 a minute per person (all chats together) | `LIMIT#msg#<YYYYMMDDHHMM>` |
| New buddy requests | 20 a day | `LIMIT#req#<day>` |
| Open requests without an answer | 3 | count of unexpired `REQOUT#` (declined ones included until they run out) |
| Buddies | 200 | `buddyCount` |
| Handle lookups | 60 a day | `LIMIT#find#<day>` |
| Nearby lists | 20 a day | `LIMIT#near#<day>` |
| Area updates | 1 a day | `LIMIT#area#<day>` |
| Posts | 10 a day | `LIMIT#post#<day>` |
| Reports | 10 a day | `LIMIT#report#<day>` |
| Club join requests waiting | 5 | count of `JOINOUT#` |
| Club join request life | 14 days | TTL |
| Ask again after decline | 30 days | `JOINNO#` |
| Club members | 200 | `memberCount` |
| Clubs a person is in | 10; clubs founded: 3 | `clubCount < :10`, `foundedCount < :3` on the profile, in the join/create transaction |
| Family members | 8; one family per person | `memberCount < :8`; `W#<sub>`/`FAMILY` put with `attribute_not_exists(SK)` |
| Family code tries | 10 a day | `LIMIT#code#<day>` |
| Cheers sent | 10 a day | `LIMIT#cheer#<day>` |
| Plans | 5 upcoming as organiser; 20 invitees; starts 15 min to 60 days ahead | |
| Stage throttle | existing 50 rps / burst 100; route throttle 10/20 on `POST /v1/social/chats/{key}/messages`, 20/40 on `GET /v1/social/chats/{key}/messages` and on `GET /v1/social/chats`, 2/5 on `POST /v1/social/reports` (polls can never take the whole stage; `poll.ts` backs off to 30 s on a 429) | `route_settings` |

Days for counters use the phone's day only where stated; counters use India time like `ddb.take_daily` (simpler, and the limit is only a guard).

`notify` map in the profile (all booleans): `messages` (true), `requests` (true), `plans` (true), `clubChat` (false), `family` (true), `preview` (false).

### 2.4 Premium

- The owner said only today's steps are free, so **Walk buddies is premium** by default (owner question 1). Today `PREMIUM_FOR_ALL=1`, so everyone has it while testing.
- Copy `_need_premium` from `steps/food/handler.py`: `premium.status(lambda: premium.sign_in_email(_auth, ddb.user_pk(sub)))[0]`; `Unavailable` → 503, `False` → 402 `premium_required`. Needs the `AUTH_TABLE` env, the `read_sign_in_email()` statement (a local helper inside `ApiStack.__init__`, `api_stack.py` ~282) and `/steps/premium-emails` read, as `steps-food`.
- Always allowed without premium (so a person can protect themselves and leave): `GET /v1/social/me`, all DELETE routes, `POST /v1/social/blocks`, `POST /v1/social/reports`, leaving a club or family, `PUT /v1/social/me` with `notify` only, and push token routes.
- Receiving is not checked: a free person's buddy can still send them messages, but the free person cannot open the chat until premium (the app shows `PremiumGate` with `title` and `onBack`, the full-screen Premium card). Simple rule: the caller is checked, never the other person.
- In the app, Buddies settings and Family settings are not gated, so a lapsed person can still unblock, leave and change notifications. The menus with Report and Block sit on gated screens; for a lapsed person they go through Buddies settings → Safety → "Report or block a walker" (walker ID input, then the Report sheet with "Also block" on).

### 2.5 Routes

All paths start `/v1/social`. "Body" is the JSON request; "Reply" is the 200/201 JSON. P = premium checked.

Profile and settings:

| Method, path | P | Body | Reply | Errors |
|---|---|---|---|---|
| GET `/me` | — | — | `{"joined": false}` or `{"joined": true, "pid", "handle", "name", "handleChangeFrom" (ms), "nearby": bool, "areaSetOn", "notify": {...}, "counts": {"requestsIn", "unread", "clubInvites", "clubRequests"}}` | — |
| POST `/join` | P | `{"adult": true, "terms": "2026-11", "handle", "name"}` | as GET `/me` | `banned` (a `BAN#` exists), `adult_required`, `terms_required`, `handle_invalid`, `handle_taken`, `text_not_allowed`, `already`, `unauthorized` (account deleted: the profile and handle claim are one TransactWriteItems with two ConditionChecks on `steps-auth` copied from `_profile` in `steps/data/handler.py`: `USER#<sub>`/`PROFILE` exists and `DELETED#<sub>`/`DELETED` does not; nothing is written) |
| PATCH `/me` | P* | `{"name"?, "handle"?, "notify"?}` | as GET `/me` | `handle_too_soon`, `handle_taken`, `handle_invalid`, `text_not_allowed` (*`notify` alone needs no premium) |
| PUT `/me/area` | P | `{"area": "tdr1v"}` (regex `^[0-9b-hjkmnp-z]{5}$`) | `{"nearby": true, "areaSetOn"}`. One TransactWriteItems: Put `AREA#<new>`/`R#<new random>#<sub>`, Delete the old `AREA#<profile.area>`/`<profile.areaKey>` when there is one, Update profile `area`, `areaKey`, `areaSetOn` with condition `areaKey = :old` (or `attribute_not_exists(areaKey)`) | `bad_request`, `daily_limit` (same area again on the same day returns 200 without counting) |
| DELETE `/me/area` | — | — | `{"nearby": false}` (deletes the `AREA#` item and `area`) | — |
| PUT `/me/push` | — | `{"token": "ExponentPushToken[...]", "platform": "android"}` | 204 | `bad_request` (token must match `^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$`) |
| DELETE `/me/push` | — | `{"token"}` | 204 | — |
| PUT `/me/steps` | P | `{"day", "steps", "weekStart", "weekSteps", "tz"}` | `{"stored": bool}` (stored only if the person has family `share` on or `board` on in any club; else nothing is kept) | `bad_request` (steps 0–200000) |
| DELETE `/me` | — | — | `{"erased": true}` (leave Walk buddies: runs erase, 6.3) | `unavailable` |

Find and requests:

| Method, path | P | Body | Reply | Errors |
|---|---|---|---|---|
| GET `/walkers/{handle}` | P | — | `{"walker": Walker}` | `not_found` (also self, blocked, banned), `daily_limit` |
| GET `/nearby` | P | — | `{"walkers": [Walker], "areaSetOn"}`: up to 30, chosen at random across my cell and its 8 neighbours (A4) and shuffled as one list (no cell order); handle only (no name); no distances, no area code | `conflict` (my nearby is off: you must show yourself to see others), `daily_limit` |
| GET `/requests` | P | — | `{"incoming": [{"walker", "at"}], "outgoing": [{"walker", "at"}], "clubInvites": [{"club": ClubCard, "by": Walker, "at"}]}` | — |
| POST `/requests` | P | `{"pid"}` | `{"state": "requested"}` or `{"state": "buddies"}` when they had already asked me | `not_found`, `already`, `daily_limit`, `open_limit`, `buddy_limit` (409 `conflict` with `"why": "buddy_limit"`) |
| POST `/requests/{pid}/accept` | P | — | `{"state": "buddies", "walker"}` | `not_found`, `buddy_limit` |
| POST `/requests/{pid}/decline` | — | — | 204: deletes my `REQIN#`; the sender's `REQOUT#` stays until its TTL with `declined` set, so to them it still reads "Asked" and then runs out. While it exists, POST `/requests` to me returns 200 `{"state": "requested"}` with no new item and no push | — |
| DELETE `/requests/{pid}` | — | — | 204 (cancel my own) | — |

Buddies, posts, blocks, reports:

| Method, path | P | Body | Reply | Errors |
|---|---|---|---|---|
| GET `/buddies` | P | — | `{"buddies": [{"walker", "since", "lastPostDay"}]}` sorted by name | — |
| DELETE `/buddies/{pid}` | — | — | 204: removes both `BUDDY#` items and both inbox rows, and writes a `SWEEP#` job for the chat partition, in one transaction (the cron deletes the messages) | — |
| GET `/buddies/{pid}/walks?before=<postId>` | P | — | `{"walker", "walks": [Post], "more": bool}` (20 a page) | `forbidden` (not buddies), `not_found` |
| POST `/posts` | P | `{"walkKey", "activity", "day", "distanceM", "movingS", "steps"}` | `{"postId"}`; `postId` = base32 of `sha256(sub + walkKey)[:8]` so a retry writes the same item | `bad_request` (distance 0–300000 m, movingS 0–86400, day not in the future), `daily_limit` |
| GET `/posts/mine` | P | — | `{"walks": [Post]}` | — |
| DELETE `/posts/{postId}` | — | — | 204 | — |
| GET `/blocks` | — | — | `{"blocked": [{"pid", "handle"}]}` (only `byMe`) | — |
| POST `/blocks` | — | `{"pid"}` or `{"handle"}` (the handle form serves Buddies settings without premium, 2.4) | 204 (effects in 5.4) | `not_found` |
| DELETE `/blocks/{pid}` | — | — | 204 (unblock; nothing comes back: not buddies, no chat) | — |
| POST `/reports` | — | `{"kind", "pid"? or "handle"?, "ref"?, "reason", "note"?}` | `{"reportId", "ackBy": ms}` | `bad_request`, `daily_limit`, `not_found` |

`Post` = `{"postId", "activity", "day", "distanceM", "movingS", "steps"}`. `kind`: `walker`, `message`, `post`, `club`, `plan`, `family`. `ref`: the message id (with the chat key as `"<cid>/<msgId>"`), post id, club id or plan id. `reason`: `spam`, `harassment`, `hate`, `sexual`, `under18`, `danger`, `impersonation`, `other`.

Chat (one set of routes for buddy, club and family chats; `{key}` is `b.<pid>`, `c.<clubId>` or `f.<famId>`):

| Method, path | P | Body | Reply | Errors |
|---|---|---|---|---|
| GET `/chats` | P | — | `{"chats": [{"key", "kind", "title", "lastAt", "lastText"?, "lastMine", "unread"}]}`: buddy inbox rows plus my clubs and family (BatchGetItem of their `LAST` items; `unread` for groups = 1 when `lastMsgAt > readUpTo`, else 0; no text for groups) | — |
| GET `/chats/{key}/messages?after=<msgId>` or `?before=<msgId>` | P | — | `{"messages": [{"id", "mine", "from": Walker-lite {"pid","handle","name"} (`name` per the 2.1 rule), "text", "at"}], "more": bool}`; ascending; 50 at most; messages from people I have blocked, or who blocked me, are left out | `forbidden` (not a buddy / member), `not_found` |
| POST `/chats/{key}/messages` | P | `{"text", "clientId"}` (clientId: 16–36 chars from the phone) | 201 `{"message": {...}}`; same `clientId` again returns the first message | `text_not_allowed`, `rate_limited`, `forbidden` |
| POST `/chats/{key}/read` | — | `{"upTo": "<msgId>"}` | 204 (buddy: `unread` = 0; group: `readUpTo`) | — |
| DELETE `/chats/{key}/messages/{msgId}` | — | — | 204: own message, or any message in a club where I am owner or admin, or in my family if I am its owner | `forbidden` |

Sending a message: take the minute counter first (a failed send costs one), then one TransactWriteItems: buddy chat = the message, my inbox row (`unread` unchanged), theirs (`ADD unread 1`), a ConditionCheck that `W#<me>`/`BUDDY#<them>` exists, and Put `W#<me>`/`SENT#<clientId>` `{msgId, cid}` with `attribute_not_exists(SK) OR expiresAt < :now`; group chat = the message, Put `LAST`, a ConditionCheck on my `MEM#`, `SENT#` as above, and Put `W#<me>`/`WROTE#<cid>` (idempotent). If the `SENT#` condition fails, GetItem it and return the stored message. Then push (4.4).

Transactions (each one TransactWriteItems):

- Buddy accept (also a mutual request): Delete both `REQIN#`/`REQOUT#` (`attribute_exists`), Put both `BUDDY#` (`attribute_not_exists`), Update both profiles `ADD buddyCount :1` with `buddyCount < :200`.
- Club accept / invite accept: Delete `JOINREQ#<sub>` or `INVITE#<sub>` (`attribute_exists`), Put `MEM#<sub>` (`attribute_not_exists`), Update META `ADD memberCount :1` with `memberCount < :200`, Put W# `CLUB#<clubId>`, Update the joiner's profile `ADD clubCount :1` with `clubCount < :10`. Club create also does `ADD foundedCount :1` with `foundedCount < :3`.
- Family create / join: Update FAM META `ADD memberCount :1` with `memberCount < :8`, Put `MEM#` (`attribute_not_exists`), Put `W#<sub>`/`FAMILY` (`attribute_not_exists(SK)`).
- Leave and remove: the `MEM#` delete, `ADD memberCount :-1` and (clubs) `ADD clubCount :-1` in one transaction.
- Tests: accept twice, and each cap reached.

Plans:

| Method, path | P | Body | Reply | Errors |
|---|---|---|---|---|
| POST `/plans` | P | `{"startsAt", "tz", "place", "note"?, "invite": [pid]}` or `{..., "clubId"}` | 201 `{"plan": Plan}` | `bad_request` (time window, 1–20 invitees, all must be buddies), `forbidden` (club: must be a member), `daily_limit` (5 upcoming), `text_not_allowed` |
| GET `/plans` | P | — | `{"plans": [Plan]}`: upcoming, mine, invited, and my clubs' (block rules 5.4) | — |
| GET `/plans/{planId}` | P | — | `{"plan": Plan, "invitees": [{"walker", "answer"}]}` (club plans: only people who answered; block rules 5.4) | `not_found` |
| PATCH `/plans/{planId}` | P | `{"startsAt"?, "place"?, "note"?, "invite"?: [pid]}` (organiser) | `{"plan": Plan}`; all invitees are told. A `startsAt` change rewrites every `PLAN#<startsAt>#<planId>` link (W# of organiser and invitees, the `CLUB#` link) in one transaction (at most 22 items) | `forbidden`, `conflict` (cancelled) |
| POST `/plans/{planId}/cancel` | — | — | `{"plan": Plan}`; invitees told | `forbidden` |
| PUT `/plans/{planId}/answer` | P | `{"answer": "going" \| "not_going"}` | `{"plan": Plan}` | `forbidden`, `conflict` |

`Plan` = `{"planId", "organiser": Walker, "club"?: {"clubId", "name"}, "startsAt", "tz", "place", "note", "status", "myAnswer", "going": n, "notGoing": n}`.

Clubs:

| Method, path | P | Body | Reply | Errors |
|---|---|---|---|---|
| POST `/clubs` | P | `{"name", "area", "about"?, "hidden": bool}` | 201 `{"club": Club}` (I am owner) | `text_not_allowed`, `conflict` (`why`: `club_limit`) |
| GET `/clubs?q=` | P | — | `{"clubs": [ClubCard]}`: name prefix (A11) and area first word (A12), merged, not hidden, 20 at most; `q` 2–40 chars | — |
| GET `/clubs/mine` | P | — | `{"clubs": [ClubCard]}` | — |
| GET `/clubs/{clubId}` | P | — | `{"club": Club, "members"?: [{"walker", "role"}]}` (members only for members; 200 at most) | `not_found` (hidden and I am not a member or invited) |
| PATCH `/clubs/{clubId}` | P | `{"name"?, "area"?, "about"?, "hidden"?}` (owner, admin) | `{"club": Club}` | `forbidden` |
| DELETE `/clubs/{clubId}` | — | — | 204 (owner): deletes META and the members' `CLUB#` items and writes a `SWEEP#` job for the `CLUB#` and `CHAT#c.<clubId>` partitions (the cron deletes the rest; reads 404 once META is gone) | `forbidden` |
| POST `/clubs/{clubId}/join` | P | — | `{"state": "asked"}` | `already`, `join_limit`, `declined_recently`, `conflict` (`club_full`), `not_found` (hidden) |
| DELETE `/clubs/{clubId}/join` | — | — | 204 (cancel my request) | — |
| GET `/clubs/{clubId}/requests` | P | — | `{"requests": [{"walker", "at"}]}` (owner, admin; people in a `HIDE#` relation with the viewing admin are left out) | `forbidden` |
| POST `/clubs/{clubId}/requests/{pid}/accept` | P | — | `{"member": {...}}` | `forbidden`, `conflict` (`club_full`), `not_found` |
| POST `/clubs/{clubId}/requests/{pid}/decline` | — | — | 204; writes `JOINNO#` for them (30 days) | `forbidden` |
| POST `/clubs/{clubId}/invites` | P | `{"pid"}` (owner, admin; must be the admin's buddy) | 201 | `forbidden`, `already`, `conflict` (`club_full`) |
| POST `/clubs/{clubId}/invite/accept` | P | — | `{"club": Club}` | `not_found`, `conflict` (`club_full`, `club_limit`) |
| POST `/clubs/{clubId}/invite/decline` | — | — | 204 | — |
| PUT `/clubs/{clubId}/members/{pid}/role` | P | `{"role": "admin" \| "member"}` (owner only) | 204 | `forbidden` |
| DELETE `/clubs/{clubId}/members/{pid}` | — | — | 204. `pid` = `me` to leave. Admins remove members (not the owner, not other admins unless owner). A removed person gets `JOINNO#` (30 days). The owner leaving hands the club to the longest-serving admin, else the longest-serving member; the last member leaving deletes the club. | `forbidden` |
| PUT `/clubs/{clubId}/board` | P | `{"on": bool}` (off needs no premium) | 204. Off, or leaving the club: when the person then has no board on and no family `share`, delete `W#<sub>`/`SHARE#STEPS` at once | `forbidden` |
| GET `/clubs/{clubId}/board` | P | — | `{"weekStart", "rows": [{"walker", "weekSteps"}]}` sorted high first; only members with `board` on and a `SHARE#STEPS` item of this week; I see my own row only if mine is on | `forbidden` |
| GET `/clubs/{clubId}/reports` | P | — | `{"reports": [{"reportId", "kind", "reason", "snapshot", "at"}]}` (owner, admin; open only) | `forbidden` |
| POST `/clubs/{clubId}/reports/{rid}/close` | — | `{"action": "dismiss" \| "removed"}` | 204. Club admins close only their club pointer; the owner's queue item stays open until the app owner closes it. | `forbidden` |

`ClubCard` = `{"clubId", "name", "area", "memberCount", "myState": "none" | "asked" | "invited" | "member"}`. `Club` = ClubCard + `{"about", "hidden", "myRole", "myBoard"}`.

Family:

| Method, path | P | Body | Reply | Errors |
|---|---|---|---|---|
| POST `/family` | P | `{"name"}` | 201 `{"family": Family}` with a new code | `conflict` (`in_family`), `text_not_allowed` |
| GET `/family` | P | — | `{"family": Family \| null}` | — |
| PATCH `/family` | P | `{"name"}` (owner) | `{"family"}` | `forbidden` |
| POST `/family/code` | P | — (owner) | `{"code", "codeExpiresAt"}` (old code deleted) | `forbidden` |
| POST `/family/join` | P | `{"code"}` (8 chars, Crockford base32, dashes and case ignored; refused when `expiresAt <= now`) | `{"family"}` | `not_found` (`bad_code`, also when the joiner has a `HIDE#` with any member), `conflict` (`family_full`, `in_family`), `daily_limit` |
| PATCH `/family/me` | P* | `{"share"?: bool, "alertBy"?: "HH:MM" \| null, "tz"?}` (*turning things off needs no premium) | `{"family"}`. `share` false also clears `alertBy` and deletes the `ALERT#` slot; then, when no club board is on, deletes `W#<sub>`/`SHARE#STEPS` at once (same on leaving the family) | `bad_request` (`alertBy` only 09:00–14:00 on the hour or half hour; needs `share` on) |
| POST `/family/cheers` | P | `{"pid"}` | 204 | `forbidden`, `daily_limit` |
| DELETE `/family/members/{pid}` | — | — | 204. `pid` = `me` to leave. The owner can remove anyone. The owner leaving hands over to the longest-serving member; the last one leaving deletes the family. | `forbidden` |

`Family` = `{"famId", "name", "myRole", "code"? (owner only), "codeExpiresAt"?, "members": [{"walker", "role", "share", "today"?: {"day", "steps"}, "alertBy"?}], "cheersToMe": [{"from": Walker, "at"}] (today)}`.

### 2.6 Server files

| File | What |
|---|---|
| `lambda_src/python/steps/social/handler.py` | `main`, route table, profile and premium checks |
| `steps/social/keys.py` | key builders (1.2), id makers, chat-key hashing |
| `steps/social/walkers.py` | join, profile, handle, area, nearby, push tokens, shared steps |
| `steps/social/buddies.py` | requests, buddies, blocks, posts |
| `steps/social/chat.py` | messages, inbox, read |
| `steps/social/clubs.py`, `family.py`, `plans.py` | as named |
| `steps/social/reports.py` | reports, ban checks |
| `steps/social/filter.py` | text filter (5.5) |
| `steps/social/geohash.py` | neighbours of a geohash-5 cell (pure) |
| `steps/social/limits.py` | `take(table, sub, kind, max, per="day"\|"minute")` |
| `steps/social/push.py` | Expo push sender (4.4) |
| `steps/social/erase.py` | `erase_walker(table, sub)` (6.3) |
| `steps/social/cron.py` | `main`: alerts, sweep jobs, overdue reports, erase backstop; SQS records → group push fan-out (4.4) |
| `stacks/api_stack.py` | the two Lambdas (`steps-social-cron` timeout 5 min; both `logs.RetentionDays.SIX_MONTHS`), grants, routes, route throttles, EventBridge `rate(15 minutes)`, SQS `steps-social-push` (+ DLQ, as the ingredient queue) read by `steps-social-cron` with `max_concurrency=2` |
| `stacks/data_stack.py` | the table and GSIs |
| `config/config.py` | `social_table`, SSM names `blocked-words`, `expo-push-token`, `moderators` |
| `scripts/set-secret.sh` | allow the three new names |
| `scripts/moderate.py` | owner tool (5.3) |

IAM: `steps-social` and `steps-social-cron`: `grant_read_write_data` on `steps-social` (with indexes), SSM read of the three new parameters and `premium-emails`, `read_sign_in_email()`. `steps-social`: `dynamodb:ConditionCheckItem` on the auth table with LeadingKeys `USER#*`, `DELETED#*` (join), send to `steps-social-push`. `steps-social-cron`: GetItem on the auth table with LeadingKeys `DELETED#*` (erase backstop). `steps-data`: `grant_read_write_data` on `steps-social` for erase. No SES.

## 3. Chat delivery

### 3.1 Choice: polling over REST, push to wake

| | REST polling | API Gateway WebSocket |
|---|---|---|
| New infrastructure | none (same API, authorizer, Lambda) | WebSocket API, `$connect` authorizer (token in the query string), connection table, fan-out code, `PostToConnection` grants |
| App work | a timer in `useChat` | connect, reconnect, heartbeat, Android app-in-background drops, resync after gaps |
| Delay | up to 4 s while the chat is open | under 1 s |
| Cost at a small start (100 people chatting 30 min a day) | about 1.35 M requests a month: about USD 1.4 API + under USD 1 Lambda + about USD 0.2 DynamoDB reads | about USD 0.1 connection minutes + messages, but connection-table writes and the extra Lambda on every connect; similar total |
| Failure modes | simple: a failed poll is retried | stale connections, double delivery, ordering after reconnect |

Polling costs about the same at this size and is far simpler. **Use polling.** `useChat` hides the transport, so a WebSocket can replace it later (when peak concurrent open chats pass about 100, which is where the 20 rps poll throttle in 2.3 starts to bite — watch 4xx on the access log — or when the owner asks for "typing…") without changing views.

### 3.2 Polling rules (in `src/buddies/poll.ts`, tested)

- Open chat, app in front: poll `GET /chats/{key}/messages?after=<last>` every 4 s; after 60 s with nothing new, every 10 s; after 5 min, every 30 s. Any new message or own send resets to 4 s. A 429 sets 30 s until the next success.
- Chat list (`GET /chats`): on focus and every 30 s while shown.
- App in background or chat closed: no polling. A push (4.4) brings the person back.
- `GET /me` (badge counts): on app start, on Buddies focus, and when a push arrives while the app is in front.
- Offline: stop the timer; resume on reconnect. Unsent messages stay in the list marked "Not sent · Tap to retry".

## 4. Push

### 4.1 What the owner sets up (once; T16c lists it, the owner does it)

1. Firebase console (free plan): create project "Steps", add an Android app with package `com.neutcrafts.steps`. Download `google-services.json`.
2. Keep `google-services.json` **out of the public repo** (add it to `.gitignore`). Add a GitHub secret `GOOGLE_SERVICES_JSON` (base64 of the file). The Android workflow writes it to the repo root before `npx expo prebuild` (skipped when the secret is empty). `app.json` stays unchanged; a new `app.config.ts` returns `({config}) => ({...config, android: {...config.android, ...(fs.existsSync("./google-services.json") ? {googleServicesFile: "./google-services.json"} : {})}})`, so prebuild still works on forks and local builds without the file.
3. Firebase console → Project settings → Service accounts → Generate new private key (FCM V1). Upload it to Expo: `eas credentials` → Android → `com.neutcrafts.steps` → Push notifications: FCM V1 → upload the JSON. Never put this key in either repo.
4. Expo dashboard → project `ae097827-…` → Access tokens: create a robot token for push ("enhanced push security" on). Store it with `scripts/set-secret.sh expo-push-token`.
5. Store the owner's own `sub` (from `GET /v1/me` in the app's account screen, T16b shows it under the owner's Buddies settings as "Account id" for this purpose) with `scripts/set-secret.sh moderators` as a JSON list `["<sub>"]`.

### 4.2 App side

- Token: `Notifications.getExpoPushTokenAsync({ projectId })` with the EAS project id from `Constants.expoConfig.extra.eas.projectId`. `registerPush` catches any error from it (a build without FCM throws), stores nothing and leaves the switches working; `push.test.ts` covers a token call that throws.
- When: the first time the person turns on any Buddies notification switch, or right after joining if they tap "Turn on" on the notification card. Before asking: `ensureChannels()` creates the new `buddies` channel. Android 13+: `requestNotificationPermission()` (existing). If refused, the switches show off with a line "Notifications are off for Steps in Android settings" and an "Open settings" text button. Walk buddies works without push (Apple 5.1.2, Google).
- Send the token with `PUT /me/push` on each app start (renews the TTL) if it changed or 7 days have passed (kv `buddies.push`). On leaving Walk buddies, `DELETE /me/push`. Sign-out: see 8.2 `leaveDevice`.
- Channel `buddies` (importance default, no sound override). Add it to `src/notifications/channels.ts`.
- Taps: data `{ "open": "buddies", "to": "<route>" }`. Extend `tapTarget` to accept it, return a route string from a fixed allow-list (`/buddies`, `/buddies/chat/<key>`, `/buddies/requests`, `/buddies/plan/<id>`, `/buddies/club/<id>`, `/buddies/family`), and wire `queueTap`/`takeTap`/`onTap` in `src/app/_layout.tsx` as its comment already describes.

### 4.3 Events and switches

| Event | To | Switch | Text (preview off) | Text (preview on) |
|---|---|---|---|---|
| Buddy request | receiver | `requests` | "<name> wants to be walk buddies" | same |
| Request accepted | sender | `requests` | "<name> is now your walk buddy" | same |
| Buddy message | receiver | `messages` | "New message from <name>" | "<name>: <first 80 chars>" |
| Club join request | owner and admins | `requests` | "Someone asked to join <club>" | "<name> asked to join <club>" |
| Join accepted / invite | the person | `requests` | "You're in <club>" / "<name> invited you to <club>" | same |
| Club message | members | `clubChat` (default off) | "New message in <club>" | "<club> · <name>: <text>" |
| Plan invite / change / cancel | invitees | `plans` | "<name> planned a walk" / "Walk plan changed" / "Walk plan cancelled" | adds day, time and place |
| Family message, cheer, new member | family | `family` | "New message in <family>" / "<name> cheered you on" / "<name> joined <family>" | adds text for messages |
| Family alert | other members | `family` | "Check in with your family in Steps" | "<name>'s steps haven't come in by <HH:MM>" |
| New report | moderators | always | "New report waiting" | same |

Rules: buddy chats: at most one message push per chat per person per 60 s (`GATE#<cid>`); club and family chats: at most one per chat per 60 s (the group `GATE` item); both are conditional puts with `attribute_not_exists(PK) OR expiresAt < :now`. No push to someone who blocked the sender. Names are buddy display names (handle when empty). No push carries an area, steps or a place unless preview is on and it is the plan text.

### 4.4 Server sender (`steps/social/push.py`)

- Club and family message pushes run off the request: after the message write, `steps-social` sends `{cid, msgId}` to SQS `steps-social-push`; `steps-social-cron` takes it, checks the group `GATE`, reads recipients with one Query of `MEM#` `FilterExpression push = true` (no per-member profile reads), then their `PUSH#` tokens, and calls `send`. Buddy messages and the other events send inline (one or a few people).
- `send(table, subs, kind, title, body, data)`: reads each person's `notify` switch (skipped when the caller already filtered by `MEM#.push`) and `PUSH#` tokens, posts to `https://exp.host/--/api/v2/push/send` in batches of 100 with header `Authorization: Bearer <expo-push-token>`, `channelId: "buddies"`, timeout 3 s, best effort (a failure is logged without tokens or text and never fails the request).
- A ticket with `DeviceNotRegistered` deletes that `PUSH#` item. No receipt polling.
- Uses `urllib.request` (no new dependency).

## 5. Moderation

### 5.1 Report flow (app)

1. "Report" in any person's, message's, post's, club's or plan's menu opens the Report sheet (7.4).
2. The person picks a reason, may write a note (300), and a switch "Also block <name>" (on by default for `harassment`, `sexual`, `danger`; off otherwise). Send.
3. The app calls `POST /reports` (then `POST /blocks` if the switch is on) and shows the snackbar "Thanks. We've got your report and will act on it within 36 hours." This in-app reply is the IT Rules acknowledgement.
4. A reported message is hidden at once for the reporter (kv `buddies.hiddenMsgs`).

### 5.2 Server

- `POST /reports` copies a `snapshot` of the reported thing (message text, handle, name, club name and about, plan place, post numbers) so it survives deletion, sets `dueAt` (`at` + 24 h for `sexual`, `under18`, `danger`; `at` + 36 h for the rest, 5.6) and pushes "New report waiting" to the moderators.
- Club content (`c.` messages, club plans) also writes a `CLUB#<id>`/`REPORT#<rid>` pointer and pushes the club's owner and admins, except when the target is the club's owner or an admin, or `kind` is `club`: those go only to the app owner's queue.
- Cron (every 15 min): pushes the moderators again when an open report passes its `dueAt` (once per report) and when one has been open more than 6 days (7-day resolve target, once per report), and once a day at 09:00 IST "N reports waiting, oldest <age>".

### 5.3 Owner tool (`stepsinfra/scripts/moderate.py`)

Run on the owner's PC with the owner's AWS login (`python scripts/moderate.py <command>`). No admin route on the API, so there is no admin token to steal.

| Command | Does |
|---|---|
| `list` | open reports, oldest first: id, age, due, reason, kind, snapshot text |
| `show <rid>` | the report, the target's handle, pid, count of past reports against them, ban state |
| `gone <handle or pid>` | the `GONE#` sign-up record of a deleted walker (legal requests only) |
| `remove <rid>` | deletes the reported message, post, plan or club; status `removed` |
| `dismiss <rid>` | status `dismissed` |
| `ban <rid>` / `ban-handle <handle>` | writes `BAN#<sub>`, sets `banned` in the profile, deletes their `AREA#` item, hides their club search entries, status `banned` |
| `unban <handle>` | removes the ban |
| `stats` | counts by status in the last 30 days (for the yearly reminder and the owner's own records) |

Closing sets `closedAt`, `expiresAt` = closedAt + 180 days and moves `g1pk` to `REPORTS#<status>`. Tests use moto (9.1).

### 5.4 Block, everywhere

Blocking writes `HIDE#` both ways (`byMe` on mine, `byThem` on theirs) in one transaction, then:

| Place | Effect |
|---|---|
| Buddies | buddy items deleted both ways; both inbox rows deleted; a `SWEEP#` job deletes the buddy chat's messages |
| Requests | any request either way deleted |
| Find by ID, nearby, club members list, club board | each is left out for the other (404 on lookup) |
| Club chat | each other's messages left out of reads; neither is removed from the club |
| Club invites | invites between them deleted; neither can invite the other |
| Family | the blocker leaves the family (the app warns first: "Blocking takes you out of <family>"); later, family join is refused (404 `bad_code`) when the joiner has a `HIDE#` with any member |
| Club join requests | left out of the admin's request list (`GET /clubs/{id}/requests`) when either has hidden the other |
| Plans | if the blocker organised it, the blocked person's invite is removed; if the blocked person organised it, the blocker's invite is removed. Club plans: a plan whose organiser has a `HIDE#` with the caller is left out of `GET /plans` and is 404 on `GET /plans/{id}`. On every plan, invitees and answers of people in a `HIDE#` relation with the caller are left out of the lists and of the `going`/`notGoing` counts |
| Push | nothing from the blocked person reaches the blocker |

Unblock removes `byMe`; the item is deleted when both flags are false. Nothing comes back.

### 5.5 Text filter (`steps/social/filter.py`)

Applied to: messages, handles, display names, club name, area and about, family name, plan place and note. Not to report notes.

- Normalise: NFKC, lower case, `0→o 1→i 3→e 4→a 5→s 7→t @→a $→s`, drop spaces and dots for the word check.
- Refuse (422 `text_not_allowed`):
  - links: `https?://`, `www.`, or `\b[a-z0-9-]+\.(com|in|net|org|io|me|co|app|link|ly|xyz)\b`;
  - emails: `[^\s@]+@[^\s@]+\.[a-z]{2,}`;
  - phone numbers: a run matching `(?<!\d)\+?\d(?:[ \-.()]?\d){9,12}(?!\d)` (10–13 digits, at most one separator between digits) that starts with `+`, or has no space in it, or whose last 10 digits start with 6–9 (Indian mobile). Must refuse: "98480 12345", "+91 98480-12345", "9848012345". Must pass: "walked 5000 6000 7000 this week", "see you 6.30 or 7.45", "10,000 steps";
  - any word or phrase from SSM `/steps/blocked-words` (SecureString, JSON list; owner keeps it; never in a repo);
  - the same message text sent 5 times in 10 minutes (counter on a hash).
- Handles and names also refuse the reserved words (1.3).
- The app runs the same link, email and phone checks before sending (`src/buddies/text.ts`) to give the message at once; the server is the real check.

### 5.6 Legal contacts (IT Rules 2021, Apple 1.2, Google)

- A Grievance Officer: name and email on `neutcrafts.in/steps/grievance` and in the app (Buddies settings → "Complaints"). Values in `src/constants/app.ts` as `GRIEVANCE = { name, email, url }` (owner question 3).
- Grievance Officer (owner, 15 Nov 2026): the company director, or the owner; either may be named because Steps is not a "significant" intermediary (that needs 50 lakh+ users in India). Use a role email `grievance@neutcrafts.in` so the person can change later without an app update.
- Complaint times, IT Rules 2021 as amended by G.S.R. 120(E), in force 20 Feb 2026 (checked 15 Nov 2026 against law-firm summaries and the MeitY FAQ; the lawyer confirms the gazette text):
  - acknowledge a complaint within 24 h (automatic, 5.1);
  - complaints asking to remove prohibited content: act within 36 h (was 72 h);
  - nudity, sexual content, impersonation or morphed photos: remove within 2 h (was 24 h); the owner gets a high-priority push for these report reasons;
  - every other complaint: resolve within 7 days (was 15);
  - government or court orders: act within 3 h (was 36 h).
- Pages on `neutcrafts.in` (owner or a separate bizpage task): `/steps/terms`, `/steps/buddies-rules` (what's not allowed, including a clear ban on child sexual abuse material and on under-18 users), `/steps/safety` (meeting tips), `/steps/grievance`, `/steps/delete-account`.

### 5.7 Retention of reported content

Reports (with snapshots) and ban records are kept for 180 days after closing, also after the reporter or the reported person deletes their account. The Walk buddies sign-up record (`GONE#`: pid, handle, name, joined and 18+ dates) is kept 180 days after leaving, for legal requests only (IT Rules 3(1)(h)). Nothing else is kept. The privacy policy says so (6.5).

## 6. Privacy and safety

### 6.1 Location

- Only when the person turns on "Show me to walkers nearby" (Find screen or Buddies settings). Before the Android prompt, a sheet explains: "Steps works out your area (about 5 km across) on this phone and sends only that area code. Nobody sees where you are, how far away you are, or your route." Buttons "Continue" and "Not now".
- The phone asks for location while in use only (no background), takes one low-accuracy fix (`Accuracy.Low`), turns it into a geohash-5 code (`src/buddies/geohash.ts`), drops the coordinates, and sends `PUT /me/area`.
- Refresh: at most once a day, only while the app is in front and "Show me" is on (kv `buddies.areaSentDay`).
- Off: `DELETE /me/area` at once; the switch shows off only after the server says so (retry on failure, snackbar on error).
- If location is refused, nearby stays off; finding by ID still works.
- Nearby lists show the handle only. No name, no area name, no distance.

### 6.2 Name

- The name shown to buddies is a separate field on the server, sent only to buddies, people who asked me, and family (2.1); strangers, nearby lists, club lists and club chat show the handle. At join it is prefilled from `Profile.name` and the person can change it. `Profile.name` itself still stays on the phone, so its doc comment and the Settings text stay true.

### 6.3 Deletion cascade

`steps/social/erase.py` `erase_walker(table, sub)`:

1. Read `W#<sub>` (whole partition, consistent).
2. For each item, clean the other side (small pointer items only): handle claim; `AREA#` item (`areaKey`); `BUDDY#x` → their `BUDDY#` and `INBOX#` items, and the buddy chat partition goes into the `SWEEP#` job's `partitions`; `REQIN#`/`REQOUT#` → the matching item; `HIDE#x` → their `HIDE#` item; `CLUB#` → `MEM#`, count, hand-over or club delete (as leaving); `JOINOUT#`/`CLUBINV#` → the club's `JOINREQ#`/`INVITE#`; `FAMILY` → `MEM#`, alert slot, `CHEER#` items where `fromSub` or `toSub` = sub, hand-over or family delete (which also deletes `CODE#<code>`); `PLAN#` → organiser: delete the plan, every invitee's `PLAN#` link and, for a club plan, `CLUB#<clubId>`/`PLAN#<startsAt>#<planId>`; invited: delete `INV#`.
3. Club and family messages they wrote: add every `WROTE#` key (not only current memberships, so chats they left are covered) to the `SWEEP#` job's `authored`. The cron deletes whole partitions and their messages (Query with `from = sub` filter) in pages: Query with `LastEvaluatedKey`, BatchWriteItem 25, stop at 4 minutes and continue on the next run. Reads already hide messages whose author has no profile.
4. Write `GONE#<sub>`/`GONE` `{pid, handle, name, createdAt, adultConfirmedOn, erasedAt}` with `expiresAt` +180 days (5.7).
5. Delete the whole `W#<sub>` partition.
6. `BAN#<sub>` (if any) gets `expiresAt` +180 days only when called from `DELETE /v1/me` (account gone); from `DELETE /v1/social/me` it stays without TTL, so the person cannot leave and join again (2.1). Reports stay (5.7).

Callers:

- `DELETE /v1/social/me` (leave Walk buddies).
- `DELETE /v1/me` in `steps/data/handler.py` `delete_me`: call `erase_walker` as the **first** step, before the `DELETED` marker. If it raises, reply 503 `unavailable` with nothing else deleted; the app already shows "Couldn't delete your account. Try again." and keeps the pending state. Add `socialDeleted: true` to the reply.
- Backstop: the cron re-runs `erase_walker` for any `W#<sub>` profile whose account has a `DELETED#<sub>` marker in `steps-auth` (a daily Scan of index `g1`, which holds only profiles, clubs and reports, then GetItem of each marker).

### 6.4 Consent and the 18+ gate

- First open of Walk buddies → the Start screen (7.3) with three switches the person must turn on: "I'm 18 or older", "I live in India" (11.1 question 7) and "I agree to the Walk buddies rules" (links to rules, terms and privacy). None is pre-set. "Continue" stays disabled until all are on and the handle is valid. This is the "accept terms, cannot skip" step for Google and the 18+ check for decision 4. The server stores only `adultConfirmedOn` and `termsOn` + `termsVersion`.
- When `termsVersion` changes, or `termsOn` is more than 365 days old (IT Rules 3(1)(c) yearly notice), `GET /me` returns `"termsNeeded": true` and the app shows the Start screen again (rules switch only).
- Family step sharing is **off until the member turns it on** (Health Connect "no social sharing without explicit consent", DPDP clear affirmative action). The owner's decision said "each member can turn it off"; this keeps that and adds "starts off" (owner question 2). The first time the family screen opens, a one-time note card asks "Share your daily steps with <family>?" with "Share" and "Not now".
- Family alert: only the watched member turns it on, in their own family settings; it needs sharing on; wording is neutral and does not suggest a health problem.
- Club board: each member turns it on; off by default.
- Under-18 reports (`under18`): the owner bans the account (5.3).
- Safety tips sheet shown once before the first Plan a walk and once on first joining a club: "Meet in a busy public place. Tell someone where you're going. Leave if you feel unsafe." Link to `/steps/safety`.

### 6.5 Retention

| Data | Kept |
|---|---|
| Buddy chat messages | 365 days, or until either person removes or blocks the other, or leaves |
| Club and family messages | 180 days, or until the club or family is deleted, or the writer deletes them or leaves Walk buddies (also in chats they left earlier, via `WROTE#`) |
| Shared walks (posts) | until the person deletes them or leaves |
| Area | until "Show me" is off; 8 days after the last refresh |
| Shared steps | 15 days (only the latest item); deleted at once when family sharing and every club board are off |
| Requests, join requests, invites | 30 / 14 / 14 days |
| Plans | 7 days after the start time |
| Push tokens | 60 days unused |
| Reports and bans | 180 days after closing / after the account is gone |
| Walk buddies sign-up record (`GONE#`) | 180 days after leaving, for legal requests only |
| Lambda logs | 180 days in ap-south-1 (CERT-In Directions 2022) for `steps-social` and `steps-social-cron`; the same is advised for the existing functions (`LOG_RETENTION` is one month today; owner question 9); log no text, handles, tokens or areas |

### 6.6 Play Data safety form (update when T16 ships)

| Data type | Collected | Shared | Purpose | Optional |
|---|---|---|---|---|
| Approximate location | yes (area code only) | no | App functionality (nearby) | yes |
| Name | yes (display name) | no | App functionality | yes (handle used instead) |
| User IDs | yes (handle, walker id) | no | App functionality, account management | no (for Walk buddies) |
| Other in-app messages | yes | no | App functionality | yes |
| Fitness info | yes (walk totals posted; daily and weekly steps if shared) | no | App functionality | yes |
| Device or other IDs | yes (push token) | no | App functionality | yes |

Also: data encrypted in transit (yes, all HTTPS); deletion request (in-app and the web page `/steps/delete-account`); content rating questionnaire: "users can interact" yes, "shares location with other users" yes (approximate area match only, opt-in, no position or distance shown; owner question 10), moderation yes. App category stays Health & Fitness; follow the Child Safety Standards anyway (5.6 page, in-app report, a named contact in Play Console).

Privacy policy additions (owner): what Walk buddies collects (table above), who sees what, retention (6.5), the 180-day legal hold (reports, bans and the sign-up record), how to leave or delete, the Grievance Officer, and that steps and walks are never used for ads.

## 7. Screens

### 7.1 Where Buddies lives

The 5-slot bar (spec 5.7) does not change. Entries:

- **You tab, "More" list**: first row "Walk buddies" (ListRow, c-acc circle with the `people` icon, chevron-right). When `counts.requestsIn + counts.unread + counts.clubInvites + counts.clubRequests > 0` a Pill (tint variant) with the number sits before the chevron.
- **Walk detail** (`walk-detail-look.tsx`): a secondary Button "Share with buddies" (48 high, full width, margin-top 24) above the Delete text button, shown only when the person has joined; after sharing it reads "Shared with buddies" and opens the Share sheet in its "Remove" state. New props `share?: { state: 'none' | 'shared'; onPress(): void }`.
- **Settings**: a ListRow "Walk buddies" in Reminders that opens `/buddies/settings`.
- Push taps (4.2).

### 7.2 Shared parts

All values are from `clean-spec.ts`. The screen frame is the sub-screen frame: top padding 16, top bar row 40 (spec 5.9), title `title` (s22 med) margin-top 8, side margin 24, white page.

| Part | Build | Values |
|---|---|---|
| Person row | ListRow `tall` (56), gap 12 | left: initial circle 40 (`accentTint`, letter `body` med `accent`, same as the greeting avatar 5.1); name `body` ink over `@handle` `caption` muted; right: action or chevron; hairline under the text part except the last |
| Section heading | as "Parts" (5.11) | `body` med, margin-top 24, group margin-top 4 |
| Count pill | Pill tint | 24 high, padding 0 8, `caption` med |
| Primary / secondary actions | Button | 48, radius 16; two side by side gap 16 |
| Text action in a row | Button `text` | `body` med `accent` ("Accept", "Ask", "Join"); `body` `muted` for "Decline", "Cancel" |
| Menu | new `SpecIconButton` in `src/components/ui/spec-icon-button.tsx` (exported from `ui/index.ts`): `name: SpecIconName`, 48 × 48 touch (`sizes.nav.minTouch`), `SpecIcon` 20 muted, android ripple as Chip, required `accessibilityLabel`. Used for `more`, `bell` and the composer send circle (IconButton takes only Ionicons names) | `more` top bar right; opens a Sheet of ListRows (48) |
| Segmented control | move the spec look out of `walk-detail-look.tsx` (`ActivitySegments`) into `src/components/ui/spec-segmented.tsx` + `spec-segmented-style.ts` (`sizes.segmented`, `radius.well`/`segment`). Props `options: {key, label}[]`, `value`, `onChange`, `readOnly?` (the walk screen keeps its read-only use). Each segment a Pressable with `accessibilityRole="tab"` and `accessibilityState.selected` inside a `tablist`; labels `maxFontSizeMultiplier` 1.3, `adjustsFontSizeToFit`, `minimumFontScale` 0.85; `walk-style.test.ts` still passes | 216 × 40 (spec 5.9); check "Buddies" at 1.3 scale in the preview |
| Stat card | as walk stat cards (5.11) | 72, radius 24, card shadow, padding 0 16 |
| Note card | spec 10.3 one-time note | card, padding 16, `body`, action `body` med `accent` |
| Empty state | EmptyState | circle 40 c-acc with the screen's icon, `body` med title, `caption` muted line, optional primary Button; centred, margin-top 24 |
| Loading | spec 10.3 | layout at once; text "—" muted; no skeletons |
| Errors | Snackbar (10.3) | the message from `src/buddies/errors.ts` |

Spec additions needed (T16b adds them to `docs/design/spec.md` as section 10.8 and to `clean-spec.ts`; values come from the existing scale, nothing new in colour or type):

| Addition | Value |
|---|---|
| `sizes.input` (text field) | height 48, radius 16 (`radius.button`), fill `soft`, padding 0 16, text `body` ink, placeholder `body` muted; error line `caption` `warn` margin-top 4 |
| `sizes.bubble` | padding 8 12, radius 16, max width 78 % of the content width, gap 4 between bubbles from the same person, 12 between people; mine: fill `accent`, text `body` `white`, right; theirs: fill `soft`, text `body` ink, left; sender name above the first bubble in group chats `caption` muted; time `caption` muted under the last bubble of a group |
| `sizes.composer` | white strip, 1 dp `hair` top border, padding 8 24; input as `sizes.input` but radius 20 (`radius.chip`), grows to 5 lines; send = 40 circle `accent` with white `send` icon, gap 8; disabled at opacity 0.4 |
| `sizes.dayDivider` | `caption` muted centred, margin 16 0 |
| Icons (section 8 style) | `people`: `circle cx9 cy8.5 r3` · `path M3.5 19c.8-3 2.9-4.5 5.5-4.5s4.7 1.5 5.5 4.5` · `circle cx16.5 cy9.5 r2.5` · `path M15.5 14.6c2.3-.3 4.2 1 5 3.9`; `chat`: `path M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z`; `search`: `circle cx11 cy11 r6` · `path M15.5 15.5L20 20`; `send`: `path M4 12L20 4l-6 16-2.5-6.5z` · `path M11.5 13.5L20 4`; `flag`: `path M6 20.5V4` · `path M6 4.5h11l-2.5 4 2.5 4H6`; `block`: `circle cx12 cy12 r8` · `path M6.5 17.5l11-11`; `calendar`: `path M6 5.5h12a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2z` (IconPart has no rect) · `path M4 10h16M8.5 3.5v4M15.5 3.5v4`; `heart`: `path M12 19.5s-7-4.3-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2c0 5.2-7 9.5-7 9.5z`; `bell`: `path M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5h-14z` · `path M10 20.5h4`; `key`: `circle cx8.5 cy12 r3.5` · `path M12 12h8.5M17.5 12v3M20.5 12v2.5`; `more`: `circle cx12 cy6 r1` · `circle cx12 cy12 r1` · `circle cx12 cy18 r1`; `check`: `path M5 12.5l4.5 4.5L19 7.5` |

### 7.3 Screens (routes in `src/app/buddies/`)

Each route file is a thin wrapper: reads params, calls the hook, renders a `*Look` from `src/components/buddies/`. The look only draws.

**Start** `buddies/start.tsx` → `StartLook`
- Top bar: back. Title "Walk buddies".
- `body` muted, margin-top 8: "Find walkers by their ID or in your area, become walk buddies, chat, and share walk totals. Only accepted buddies can message you."
- Section "Your walker ID": input (`sizes.input`) with `@` prefix text `body` muted; line `caption` muted "3–20 letters, numbers or _. You can change it once a month." Live check (debounced 400 ms) shows "Taken" in `caption` `warn` on `handle_taken` at submit only (no live server lookups).
- Section "Name buddies see": input prefilled from `Profile.name`, 40 max; `caption` muted "Leave empty to show your ID."
- Two ToggleRows: "I'm 18 or older"; "I agree to the Walk buddies rules" (no supporting text; ToggleRow's `supporting` is a plain string). Directly under it a row of three text Buttons (`caption` med `accent`, 48 touch, gap 16): "Rules", "Terms", "Privacy", each opening its `neutcrafts.in` page with `Linking.openURL`.
- Primary Button "Continue" at the bottom (fixed strip as spec 10.5), disabled until valid.
- States: while sending, the button is disabled (opacity 0.4) and keeps its label; errors → snackbar; `premium_required` → `PremiumGate` with `title` and `onBack` (the full-screen Premium card).

**Home** `buddies/index.tsx` → `BuddiesHomeLook`
- Top bar: back left; `SpecSegmented` right (216 × 40, spec 5.9) "Chats" · "Buddies" · "Groups". Title "Walk buddies". Right of the title row: `SpecIconButton` `bell` → `/buddies/settings`.
- Chats: rows per chat (person row for buddies; c-acc circle with `people` for clubs; c-acc circle with `heart` for the family). Second line = last text (`caption` muted, one line, "…"), or "New messages" for groups. Right: time `caption` muted over the unread count pill. Empty: icon `chat`, "No chats yet", "Chats open once someone accepts your buddy request.", button "Find walkers".
- Buddies: first row "Requests" (c-acc `bell`, count pill) → `/buddies/requests` (shown only when there is anything); row "Find walkers" (c-acc `search`) → `/buddies/find`; then buddies as person rows → `/buddies/walker/[pid]`. Empty: icon `people`, "No buddies yet", "Find a walker by their ID or in your area.", button "Find walkers".
- Groups: section "Family" (one row, or "Start a family" / "Join with a code" rows); section "Clubs" (my clubs, then "Find a club", "Start a club"); section "Planned walks" (upcoming plans as rows: c-acc `calendar`, place `body` over day and time `caption` muted, pill "Going" when I am going; row "Plan a walk").
- Remembers the last segment (kv `buddies.segment`).

**Find** `buddies/find.tsx` → `FindLook`
- Title "Find walkers". Input with `search` icon inside on the left (icon 20 muted, gap 8), placeholder "Walker ID", search on submit. Result: one person row with "Ask" / "Asked" (muted) / "Buddies" (muted) / "Accept". Not found: `caption` muted "No walker with that ID."
- Section "Walkers in your area". If off: note card "Show yourself to walkers in your area to see them. Only your area (about 5 km) is used." with action "Turn on" (opens the location sheet, 6.1). If on: person rows with "Ask"; line `caption` muted under the heading "Updated <day>". Empty: "No one nearby has turned this on yet."
- Footer `caption` muted: "Your own ID: @handle" with "Copy" text action.

**Requests** `buddies/requests.tsx` → `RequestsLook`
- Title "Requests". Sections "Asked you" (person rows; right: "Accept" and "Decline" text actions, gap 16), "Club invites" (club rows; "Join", "Decline"), "You asked" (person rows; "Cancel"). Line under "You asked": `caption` muted "Up to 3 at a time. Requests end after 30 days." Empty all: icon `bell`, "No requests".

**Chat** `buddies/chat/[key].tsx` → `ChatLook`
- Top bar: back, then the title in the bar (name `body` med, for buddies `@handle` `caption` muted under it), right `SpecIconButton` `more`. No separate s22 title (chat needs the height).
- Message list (inverted FlatList), bubbles (`sizes.bubble`), day dividers. Long-press a bubble → Sheet: "Copy", "Delete" (own, or admin), "Report" (others').
- Composer (`sizes.composer`) at the bottom, above the keyboard: wrap the list and composer in `KeyboardAvoidingView` with `behavior="padding"` on Android too (edge-to-edge on SDK 58; do not copy `auth-layout.tsx`, which passes `undefined` on Android), `keyboardVerticalOffset` 0, and the bottom safe-area inset on the composer only while the keyboard is hidden. CI cannot show the keyboard, so T16c lists a manual phone check. Counter `caption` muted "480/500" appears from 450.
- Menu sheet: buddy → "See shared walks", "Remove buddy", "Block", "Report"; club → "Club info", "Report club", "Leave club"; family → "Family", "Leave family".
- States: first load "—"; failed send: bubble at opacity 0.4 with `caption` `warn` "Not sent · Tap to retry"; `text_not_allowed` → snackbar "That can't be sent. Links, phone numbers and some words aren't allowed."; not a buddy any more → composer replaced by `caption` muted "You can't message <name>." No empty state needed beyond `caption` muted centred "Say hello. Be kind; reports go to Steps."

**Walker** `buddies/walker/[pid].tsx` → `WalkerLook`
- Title = name; under it `@handle` `caption` muted, then "Buddies since <day>" `caption` muted.
- Buttons: primary "Message" (buddies), or "Ask to be buddies" / "Accept" / "Asked" (disabled) for others. Menu: "Remove buddy", "Block", "Report".
- Section "Shared walks": rows 56 — c-acc circle `walker` (ride: same circle, the existing ride icon if one exists, else `walker`), title `body` "2.3 km · 32 min", second line `caption` muted "Sat, 14 Nov · 3,120 steps"; no chevron (no detail). Paged on scroll. Empty: `caption` muted "No shared walks yet."

**Share sheet** (Sheet on the walk detail) → `ShareWalkSheet`
- Title "Share with buddies". A stat-card-like card (72) with the walker circle and "2.3 km · 32 min" `value`-free: `body` med over `caption` muted "3,120 steps · Sat, 14 Nov". Line `caption` muted "Only your buddies see this. No map, route or place is shared."
- Primary "Share". When shared: secondary "Remove from buddies" and `caption` muted "Shared on <day>".

**Report sheet** → `ReportSheet`
- Title "Report <name / message / club>". Reason rows (48, radio style: `check` icon `accent` at the right on the picked one): Spam; Harassment or bullying; Hate; Sexual content; Under 18; Threat or danger; Pretending to be someone; Something else. Input (3 lines, 300) "Anything else? (optional)". ToggleRow "Also block <name>" (people only). Primary "Send report". `caption` muted "Steps reviews every report, urgent ones within 24 hours."

**Plan a walk** `buddies/plan/new.tsx` and `plan/[id].tsx` (edit uses the same look) → `PlanFormLook`
- Title "Plan a walk". Day chips row (Chip 40, spec 5.9: "Today", "Tomorrow", then the next 5 day names; the selected chip uses `accentTint` fill and `accent` text — spec addition needed `chip.selected`, colours from the pill), "Other day" chip opens the system date picker. Time: chip opens the system time picker (shows "7:00 am").
- Input "Place" (60): placeholder "e.g. KBR Park main gate"; `caption` muted "Type a place name. No map pin is shared."
- Input "Note (optional)" (200).
- Invite: person rows with a ToggleRow-style switch (MaterialSwitch) at the right; for a club plan this section is replaced by "Everyone in <club> can see it."
- Primary "Send invites" / "Save changes".

`PlanLook` (`plan/[id].tsx`): title = place; `caption` muted day and time; organiser row; two buttons side by side "Going" (primary when picked, else secondary) and "Not going"; sections "Going (n)", "Not going (n)", "Not answered (n)" (buddy plans only) with person rows. Organiser menu: "Change", "Cancel walk" (confirm()). Cancelled: Pill warning variant "Cancelled" under the title, buttons hidden. Reminder: `caption` muted "We'll remind you 1 hour before" when Going (local notification).

**Clubs**
- `buddies/clubs.tsx` → `ClubSearchLook`: input "Club name or area", results as rows (c-acc `people`, name `body`, `caption` muted "Banjara Hills · 48 members"), right "Ask to join" / "Asked" / "Invited" / "Member". Empty search: `caption` muted "No clubs found. Start one?" + secondary "Start a club".
- `buddies/club/new.tsx` (and edit) → `ClubFormLook`: inputs Name (40), Area (40, "A place name, like Banjara Hills"), About (200); ToggleRow "Hide from search" with `caption` "Only people you invite can find it." Primary "Start club".
- `buddies/club/[id].tsx` → `ClubLook`: title = name; `caption` muted "Area · n members"; About `body`. Not a member: primary "Ask to join" (or "Asked · Cancel", "Join" when invited), `caption` muted "The club's admins approve every member." Member: `SpecSegmented` in the top bar "Chat" · "Walks" · "Board". Chat opens the chat look inline (same `ChatLook` body). Walks: plan rows + "Plan a club walk". Board: ToggleRow "Show my steps on the board" then rows 56: rank `body` muted (width 24), person, week steps `body` right; `caption` muted "This week (Mon–Sun). Only members who turn it on." Menu: "Members", "Invite a buddy" (admin), "Requests and reports" (admin, with count pill), "Edit club" (admin), "Leave club", "Report club".
- `buddies/club/[id]/admin.tsx` → `ClubAdminLook`: sections "Asking to join" (person rows, "Accept" / "Decline"), "Reports" (rows: reason `body`, snapshot `caption` muted 2 lines; tap → Sheet "Delete message", "Remove member", "Dismiss"), "Members" (person rows with role pill "Owner"/"Admin"; tap → Sheet "Make admin" / "Make member" (owner), "Remove from club").

**Family**
- `buddies/family.tsx` → `FamilyLook`: title = family name. Member grid: stat cards (72) in 2 columns, gap 16: initial circle, `value` steps today (or "—" muted when not shared, with `caption` "Not sharing"), `caption` muted name; tap a card → Sheet with "Cheer <name>" (primary, `heart`) and their walk totals of today. Cheers to me today: note card "Ravi cheered you on" (dismiss "OK"). Rows: "Family chat" (c-acc `chat`, unread pill), "Invite with a code" (owner; c-acc `key`), "Family settings". Empty (no family): EmptyState icon `heart`, "Walker family", "A private group of up to 8. Join with a code from a family member.", primary "Start a family", secondary "Join with a code".
- Code sheet: the code in `value` (s18 med) with spaces "K7QM 2XPA", `caption` muted "Works for 48 hours, once per person. Share it only with family." Buttons "Share" (system share sheet, text only) and "New code".
- Join sheet: input (8, upper case, `sizes.input`) and primary "Join".
- `buddies/family/settings.tsx` → `FamilySettingsLook`: ToggleRow "Share my daily steps with the family"; ToggleRow "Alert the family if my steps haven't come in by" with a time chip (09:00–14:00, half hours) shown when on, and `caption` muted "Only you can turn this on. Your phone sends steps when Steps is open or a walk is saved."; owner: input Name, "Remove a member" rows; "Leave family" (danger text button, confirm()).

**Buddies settings** `buddies/settings.tsx` → `BuddySettingsLook`
- Sections: "You" (Name, Walker ID with "Change" — disabled with `caption` "You can change it on <date>"), "Nearby" (ToggleRow "Show me to walkers nearby"), "Notifications" (ToggleRows: Messages, Requests and invites, Walk plans, Club chats, Family; ToggleRow "Show message text in notifications"), "Safety" (rows "Blocked walkers" → list with "Unblock", "Report or block a walker" (walker ID input → Report sheet; works without premium, 2.4), "Rules", "Safety tips", "Complaints" → Grievance Officer name, email, link), "Leave Walk buddies" (danger text button; confirm() "This deletes your walker ID, buddies, chats, shared walks, club and family membership. It can't be undone.", action "Leave").

### 7.4 Accessibility

- Every icon button has an `accessibilityLabel` ("Menu", "Send message", "Search"). Person rows read "<name>, @<handle>, <state>". Bubbles read "<you / name>: <text>, <time>". Count pills read "<n> new".
- Touch targets at least 48 × 48 (`sizes.nav.minTouch`). Font scale up to 1.3 (spec 10.4); rows and bubbles grow. Every `Text` and `TextInput` in `src/components/buddies` sets `maxFontSizeMultiplier={1.3}`.
- Indian scripts (spec 10.4): user-typed strings (names, messages, club, family and plan text; not handles) go through `scriptStyle(text)` in `src/components/buddies/script-style.ts`: `hasTelugu(text)` (from `food-result-layout.ts`) → `fontFamily` `TELUGU_FONT`, `lineHeight` `CLEAN_SPEC.type.telugu.lineHeight` (24); any other Indian script (`\p{Script=Devanagari}`, Tamil, Kannada, Malayalam, Bengali, Gujarati, Gurmukhi, Oriya) → system font (no `fontFamily`), `lineHeight` 24; else the token as is. Tested in `script-style.test.ts`. The composer's 5-line max height = 5 × that line height × min(fontScale, 1.3) + padding.
- Segmented controls use `accessibilityRole="tab"` with selected state. Switches announce on/off.
- New messages are not announced while typing; the chat title announces "n new messages" on focus.

### 7.5 Design preview and CI shots

- `src/design-preview/params.ts`: add screens `buddies`, `buddies-start`, `find`, `requests`, `chat`, `walker`, `plan`, `club`, `club-admin`, `family`; `PreviewParams` gets `seg?: string` (`chats`/`buddies`/`groups`, and `chat`/`walks`/`board` for `club`) and `shared?: boolean`. Add the `parsePreviewParams` cases to its test.
- Buddies screens are stack screens and render without `WithNavigationBar`: add them to the `Exclude` in `TAB_OF`'s type in `design-preview.tsx`, like `detail`. `design-preview.tsx` wraps them in `<BuddiesPreviewProvider>` inside `SampleDataProvider`.
- The walk screen in the preview is not joined (no share button) unless `&shared=1` (then joined, with the walk shared).
- `src/design-preview/sample-buddies.ts`: sample walkers (Ravi @ravi_walks, Lakshmi @lakshmi_k, Arjun @arjun22, Meena @meena_walks), 6 chat messages over two days, two requests, one club "KBR Morning Walkers" (Banjara Hills, 48 members) with a board, one family "Rao family" of 4 (one not sharing), one plan "KBR Park main gate"; at least one Telugu name and one Telugu message ("రేపు ఉదయం 6 గంటలకు") so the shot checks the font. Fed through a `BuddiesPreviewProvider` that gives the hooks fixed data (hooks take an injectable data source, 8.3).
- Ready line: the existing line with ` ${seg}` and then ` shared` appended after the existing ` edit`/` mine` parts.
- `launch-and-capture.sh`, after the food shots: `capture clean buddies smoke/clean-buddies-chats.png "&seg=chats" chats`, then `smoke/clean-buddies-buddies.png` (`seg=buddies`), `smoke/clean-buddies-groups.png`, `smoke/clean-buddies-start.png`, `smoke/clean-find.png`, `smoke/clean-requests.png`, `smoke/clean-chat.png`, `smoke/clean-walker.png`, `smoke/clean-plan.png`, `capture clean club smoke/clean-club-board.png "&seg=board" board`, `smoke/clean-club-admin.png`, `smoke/clean-family.png`. Add one dark-mode shot `smoke/clean-chat-dark.png`. T16d adds `capture clean walk smoke/clean-walk-shared.png "&shared=1" shared`.

## 8. App code layout

### 8.1 Files

| Path | What |
|---|---|
| `src/buddies/types.ts` | `Walker`, `Post`, `Message`, `ChatRow`, `Plan`, `ClubCard`, `Club`, `Family`, `NotifyPrefs`, `SocialMe` |
| `src/buddies/api-read.ts` | pure: `SocialApiError` kinds (`signin`, `premium`, `offline`, `not_found`, `forbidden`, `banned`, `not_joined`, `limit`, `text`, `handle_taken`, `handle_invalid`, `handle_too_soon`, `conflict`, `busy`, `other`) with `why`; `errorFor(status, code)`; `read*` validators and request builders, added by the task that uses each route (section 10) |
| `src/buddies/api.ts` | `SocialDeps {fetch, token, baseUrl}` with defaults `{fetch, getAccessToken, STEPS_API_URL}` (copy `src/api/food-scan.ts`); one `call(method, path, body?)` helper (15 s timeout, `tokenError`, `errorFor`); one exported function per route, added by the task that uses it |
| `src/buddies/flows.ts` | the hooks' multi-step flows as plain functions taking `{repo, api, now}`: `joinFlow`, `sendWithRetry`, `acceptRequest`, `answerPlan`, `turnSharingOn` (each added by its task) |
| `src/buddies/kv.ts` | `BUDDIES_KV_KEYS` (8.2) |
| `src/buddies/sign-out.ts` | `leaveDevice(deps)` (8.2) |
| `src/buddies/errors.ts` | message text for each error kind (snackbar) |
| `src/buddies/geohash.ts` | `encode(lat, lon, precision)` (pure) |
| `src/buddies/handle.ts` | `cleanHandle`, `handleProblem` (length, characters, reserved) |
| `src/buddies/text.ts` | `messageProblem` (empty, > 500, link, email, phone), `countLabel` |
| `src/buddies/chat-merge.ts` | merge pages by id, dedupe by `clientId`, pending and failed sends, day dividers, grouping for bubbles |
| `src/buddies/poll.ts` | `nextDelay(state)` (3.2) |
| `src/buddies/area.ts` | `areaDue(today, lastSentDay)`, `refreshArea(deps)`: permission → low fix → encode → `putArea` → kv |
| `src/buddies/share-walk.ts` | `postFromWalk(walk, day)` (only the allowed fields; `walkKey` = `walk.id`), `shareWalk(deps)`, `unshareWalk(deps)` |
| `src/buddies/steps-share.ts` | `stepsDue(state, now)` (every 30 min while in front, and after a walk save), `sendSteps(deps)` using the repo's today and this week (Mon–Sun) |
| `src/buddies/plans.ts` | `dayChoices(now)`, `planProblem`, `scheduleReminder` / `cancelReminder` (local notification 1 h before when Going; ids in kv) |
| `src/buddies/clubs.ts` | `can(role, action)` table, `boardRows` sort |
| `src/buddies/family.ts` | `formatCode`, `cleanCode`, `alertChoices`, `familyCards` |
| `src/buddies/report.ts` | `REASONS`, `blockByDefault(reason)` |
| `src/buddies/push.ts` | `registerPush(deps)`: channel → permission → token → `putPush` → kv; `pushTarget(data)` → allowed route or null |
| `src/buddies/use-buddies.ts` | `useBuddies()`: me, join, profile edits, buddies, requests, find, nearby, block, report, leave |
| `src/buddies/use-chat.ts` | `useChat(key)`: messages, send, retry, delete, read, polling; `useChats()` for the list |
| `src/buddies/use-clubs.ts` | `useClubs()`, `useClub(id)` |
| `src/buddies/use-family.ts` | `useFamily()` |
| `src/buddies/use-plans.ts` | `usePlans()`, `usePlan(id)` |
| `src/buddies/source.tsx` | `BuddiesSource` context: its default value is the real `api.ts` functions, so `_layout.tsx` needs no provider; the preview wraps screens in `BuddiesPreviewProvider` (7.5) |
| `src/components/buddies/*.tsx` | the looks in 7.3 and shared `PersonRow`, `Bubble`, `Composer`, `TextField`; `script-style.ts` (7.4) |
| `src/components/ui/spec-icon-button.tsx`, `spec-segmented.tsx`, `spec-segmented-style.ts` | 7.2 |
| `src/app/buddies/*.tsx` | route wrappers (7.3) |
| `src/constants/themes/clean-spec.ts` | the spec additions (7.2) |
| `src/premium/premium.ts` | `PREMIUM_FEATURES` entry `{key: 'buddies', label: 'Walk buddies: chat, clubs and family'}`; `SCREEN_FEATURES`: `'buddies/index'`, `'buddies/start'`, `'buddies/find'`, `'buddies/requests'`, `'buddies/chat/[key]'`, `'buddies/walker/[pid]'`, `'buddies/plan/new'`, `'buddies/plan/[id]'`, `'buddies/clubs'`, `'buddies/club/new'`, `'buddies/club/[id]'`, `'buddies/club/[id]/admin'`, `'buddies/family'`, all → `'buddies'`. `'buddies/settings'` and `'buddies/family/settings'` are **not** gated (2.4) |
| `src/notifications/channels.ts`, `taps.ts`, `src/app/_layout.tsx` | channel `buddies`, tap routing (4.2) |

### 8.2 kv keys (all wiped by `resetAll` and on sign-out)

Sign-out does not call `resetAll` (`auth-state.tsx` `signOut` is only `session.signOut()`). `src/buddies/sign-out.ts` `leaveDevice(deps)` runs first: `DELETE /me/push` (best effort, 3 s), cancel the reminders in `buddies.planReminders`, then delete every key in `BUDDIES_KV_KEYS` (`src/buddies/kv.ts`). `auth-state.tsx` `signOut` awaits `leaveDevice()` before `session.signOut()`. Tested in `sign-out.test.ts` with `memoryRepository`. T16b adds the kv part, T16c the push part.

| Key | Holds |
|---|---|
| `buddies.me` | last `GET /me` reply (for the badge and offline first paint) |
| `buddies.segment` | last Home segment |
| `buddies.areaSentDay` | day the area was last sent |
| `buddies.push` | `{token, sentAt}` |
| `buddies.drafts` | unsent composer text per chat key |
| `buddies.pending` | unsent messages `{key, clientId, text, at}` |
| `buddies.hiddenMsgs` | ids hidden after a report |
| `buddies.shared` | walk id → postId |
| `buddies.stepsSent` | `{day, steps, at}` |
| `buddies.planReminders` | plan id → local notification id |
| `buddies.tipsSeen` | `{plan: bool, club: bool}` |

### 8.3 Hook rules

- Hooks follow `src/state/use-food-book.ts`: read `useApp()` for `repo`, keep a `live` flag in effects, call plain functions with injected API functions, write kv, never call `fetch` directly. Hooks stay thin; any multi-step flow goes in `flows.ts`.
- Hooks get API functions from `BuddiesSource`, so the design preview swaps in sample data without network.
- Views never import `@/buddies/api` or `repo`.

## 9. Tests

### 9.1 Server (`stepsinfra/tests`, unittest + moto, like `test_handlers.py`; not pytest)

`tests/test_social.py` (create `steps-social` with `g1`/`g2` in the moto setup):

- join: adult and terms required; handle rules, reserved, taken (case-insensitive); profile shape; 18+ stored as a date only; no `sub` in any reply; account deleted (`DELETED#` marker) → 401 and nothing written; banned → leave → join gives 403, and the ban has no TTL after leaving.
- handle change: frees the old claim; refused within 30 days.
- area: regex; once a day; delete removes the `AREA#` item; moving to a new cell removes the old cell's entry; nearby needs own area on; nearby returns neighbours, excludes self, buddies' state shown, blocked and banned left out, never returns an area or distance; reply order does not group by cell (seeded random); an expired entry is not listed.
- names: nearby and handle lookup replies carry no `name` for strangers; club member lists and club chat show `name` only for buddies.
- requests: 20 a day, 3 open, mutual request becomes buddies, accept, accept twice, decline is silent (sender's row stays; asking again gives `requested` with no item and no push), cancel, expiry TTL set, expired `REQOUT#` not counted, 200 buddies cap.
- block: both ways; buddies, requests, inbox and chat deleted; lookup 404 both ways; club chat hides; family blocker leaves; family join with a code refused when a member is hidden; club request list leaves out hidden people; B blocks A in the same club and B organises a club plan → A cannot see it; A cannot see B's answer on a third person's plan; unblock restores nothing.
- chat: buddy only; 500 chars; 30 a minute; filter refusals (link, email, phone, word list from a patched SSM); `clientId` dedupe (same transaction; retry after a timeout returns the first message); `after`/`before` pages; unread counts and read; own delete; admin delete in a club; push gate 60 s, including an expired gate item still present; group message puts `{cid, msgId}` on the push queue and the fan-out reads `MEM#` with `push`.
- sweeps: a `SWEEP#` job with more than one page of messages finishes over two runs.
- posts: allowed fields only; same `walkKey` same id; buddies only can read; delete; 10 a day.
- plans: time window, 20 invitees, buddies only, club members only; change and cancel push; answers; TTL.
- clubs: create limits; search by name and area; hidden not found; join request, 5 waiting, accept, accept twice, decline + 30 days, 200 cap (two accepts at 199), 10 clubs per person, invite by admin to own buddy only, invite accept; roles; remove; owner hand-over on leave; last member deletes; board opt-in and sort.
- family: create, code 48 h (an expired code still in the table is refused), join, 8 cap, one family (two joins to different families: only one succeeds), share off by default, today's steps only for sharers, cheers limit, alert needs share and 09:00–14:00, share off clears `alertBy` and the `ALERT#` slot, `SHARE#STEPS` deleted when share and every board are off (also on leaving), owner hand-over.
- premium: 402 on a P route when not premium; DELETE, block, report, leave allowed without premium.
- banned: 403 on writes; ban hides from nearby and search.
- reports: snapshot copied; dueAt per reason (24 h for `sexual`, `under18`, `danger`; 36 h for the rest); club pointer; no club pointer or club push when the target is the club's owner or an admin, or `kind` is `club`; moderators pushed (push sender patched).
- terms: `termsNeeded` true when `termsOn` is more than 365 days old.
- erase: every item type in 1.3 (`CHEER#`, club plan links and the family `CODE#` included) is gone after `erase_walker`, the other side cleaned, the handle free, the area gone, `GONE#` written with +180 days, reports kept; ban gets TTL only from `DELETE /v1/me`; write in a club, leave the club, delete the account → no message from that sub remains after the cron runs; `DELETE /v1/me` calls it before the `DELETED` marker and returns 503 with nothing deleted if it fails; the cron backstop erases a profile whose account has a `DELETED#` marker.
- cron: alert sent once a day only when steps are missing; sweep jobs delete messages; overdue push once; 6-day open push once.
- `tests/test_social_filter.py`: normalisation, every refusal type, the phone cases in 5.5, no false refusal on plain walking talk ("see you at 6.30 at the gate", "10k steps", "walked 5000 6000 7000 this week").
- `tests/test_social_geohash.py`: neighbours at edges and the poles' wrap.
- `tests/test_moderate.py`: list, remove, dismiss, ban, unban on moto.
- `tests/test_auth_stack.py` SynthTest: the table and GSIs (INCLUDE projections), every `/v1/social` route with the token authorizer, route throttles (the two GET poll routes included), IAM statements (no SES, SSM names exact, auth-table `ConditionCheckItem` LeadingKeys), the push queue, 180-day log groups, the 15-minute rule.

### 9.2 App (`src/buddies/__tests__/*.test.ts`, jest, node)

- `api-read.test.ts`: `errorFor` for every status and code; every `read*` accepts good and refuses bad shapes.
- `api.test.ts`: `call` adds the token, times out, maps offline, 402 → premium, passes bodies (injected `fetch`).
- `geohash.test.ts`: the standard reference point (57.64911, 10.40744) → `u4pru` at precision 5 (`u4pruydqqvj` at 11); 0,0 → `s0000`; edges at ±90/±180; output always 5 characters from the base32 alphabet.
- `handle.test.ts`, `text.test.ts` (same cases as the server filter's link, email and phone list).
- `chat-merge.test.ts`: order, dedupe, pending → sent, failed, day dividers, grouping.
- `poll.test.ts`: 4 → 10 → 30 s and reset.
- `area.test.ts`: once a day; refused permission → nothing sent; coordinates never passed to the API function (spy checks the only argument is a 5-character string).
- `share-walk.test.ts`: only the six fields; ride vs walk; null steps.
- `steps-share.test.ts`: due rules; week Mon–Sun.
- `plans.test.ts`, `clubs.test.ts`, `family.test.ts`, `report.test.ts`, `push.test.ts` (refused permission, a token call that throws, token sent once a week, `pushTarget` allow-list).
- `script-style.test.ts`, `sign-out.test.ts` (push deleted, reminders cancelled, every `buddies.*` key gone).
- Hooks stay thin and are not unit-tested (jest here is `.ts` only, node environment, no hook-rendering library; do not add one). `flows.test.ts` tests each flow in `flows.ts` with `memoryRepository(null)` from `@/data/db.web` and jest.fn API functions: join; send with retry; accept request; answer plan; turn sharing on.

## 10. Tasks

All tasks: `npx tsc --noEmit` and `npx jest` pass (app); `python -m unittest discover -s tests -p "test_*.py"` and `npm test` pass (stepsinfra). Append to `docs/completed-tasks.md`. No commit or push without the owner's OK (the CI standing OK does not cover deploys). Never deploy without the owner's OK.

| Task | Model | Files | Done when |
|---|---|---|---|
| **T16a — server** | Sonnet | everything in 2.6, `steps/data/handler.py` (erase call), the tests in 9.1 | All routes in 2.5 work in moto tests; SynthTest passes; `cdk synth` would be needed but is **not run**; a short `stepsinfra/docs/walk-buddies-server.md` (deploy steps, SSM names, owner tool usage). Deploy only after the owner's OK and the owner's setup in 4.1 (steps 4–5). Can be done in three sittings: (1) table, profile, find, requests, block, report, erase; (2) chat, posts, push, filter; (3) plans, clubs, family, cron, moderate.py. |
| **T16b — app: start, find, requests, block, report** | Sonnet | `src/buddies/{types,api-read,api,errors,handle,geohash,area,report,source,kv,sign-out,flows}.ts(x)` (types, readers and calls for `/me` (GET, PATCH, DELETE), `/join`, `/me/area`, `/walkers`, `/nearby`, `/requests*`, `/buddies` (GET, DELETE), `/blocks*`, `/reports`), `use-buddies.ts`, `script-style.ts`, `SpecIconButton`, `SpecSegmented` (move from walk detail), looks Start, Home (Buddies segment), Find, Requests, Walker (without walks), Report sheet, Buddies settings (without notifications), You-tab row, `auth-state.tsx` sign-out hook (kv part), spec additions 7.2 in `spec.md` §10.8 and `clean-spec.ts`, premium feature key and route list, preview screens `buddies-start`, `buddies` (seg buddies), `find`, `requests`, `walker`, capture lines | Tests 9.2 for these files pass, with `api-read.test.ts` cases for the readers it added; preview shots render with sample data; no `fetch`/`repo` in views. |
| **T16c — app: chat and push** | Sonnet | `chat-merge.ts`, `poll.ts`, `text.ts`, `push.ts`, `flows.ts` (`sendWithRetry`), `use-chat.ts`, calls for `/chats*` and `/me/push`, Chat look, Bubble, Composer, Home Chats segment, notification switches, `channels.ts`, `taps.ts`, `_layout.tsx` wiring, `sign-out.ts` push part, new `app.config.ts` (4.1; `app.json` unchanged), `.gitignore`, the Android workflow step that writes `google-services.json` from the secret (skip when the secret is empty), preview `chat`, `buddies` (seg chats) | Tests pass, with `api-read.test.ts` cases for its readers; preview shots; listed for the owner on a real phone: a push test (needs 4.1) and the composer staying visible while typing. |
| **T16d — app: share a walk, buddies' walks** | Sonnet | `share-walk.ts`, calls for `/posts*` and `/buddies/{pid}/walks`, Share sheet, `walk-detail-look.tsx` `share` prop and `walk/[id].tsx` wiring through a hook (move its repo loading into `src/walks/use-walk-detail.ts` while there), Walker look walks list, preview `shared` param (7.5) | Tests pass, with `api-read.test.ts` cases for its readers; `walk` preview shot unchanged when not joined; new shot `smoke/clean-walk-shared.png` (`&shared=1`). |
| **T16e — app: Plan a walk** | Sonnet | `plans.ts`, `flows.ts` (`answerPlan`), calls for `/plans*`, `use-plans.ts`, Plan form and Plan looks, Groups "Planned walks", safety tips sheet, local reminders, `chip.selected` spec addition | Tests pass, with `api-read.test.ts` cases for its readers; `plan` preview shot. |
| **T16f — app: clubs** | Sonnet | `clubs.ts`, calls for `/clubs*`, `use-clubs.ts`, Club search, form, Club (Chat/Walks/Board), Club admin, `steps-share.ts` (board part) | Tests pass, with `api-read.test.ts` cases for its readers; `club` (seg board) and `club-admin` shots. |
| **T16g — app: family** | Sonnet | `family.ts`, `flows.ts` (`turnSharingOn`), calls for `/family*` and `/me/steps`, `use-family.ts`, Family, code and join sheets, Family settings, `steps-share.ts` (family part) | Tests pass, with `api-read.test.ts` cases for its readers; `family` shot. |
| **T16 check** | Opus | — | Shots against 7.3; safety review: report, block (5.4 table), area only, no coordinates in any request (grep + test), deletion cascade test, Data safety list. |

Order: T16a (code) → T16b → T16c → T16d → T16e → T16f → T16g → T16 check. T16b–T16g can be built and previewed with sample data before T16a is deployed; live use needs the deploy.

## 11. Owner questions and risks

### 11.1 Questions (defaults are built until you answer)

1. **Premium:** answered (15 Nov 2026): every Walk buddies feature is premium.
2. **Family step sharing starts off** (each member turns it on). Store rules point this way; OK?
3. **Grievance Officer:** answered in part: the director or the owner (5.6). Still needed: which name goes on the page.
4. **Complaint times:** checked 15 Nov 2026 (5.6: 24 h acknowledge, 36 h removal, 2 h intimate or impersonation, 7 days resolve, 3 h orders). The lawyer still confirms the gazette text before the terms page goes up.
5. **Report alert:** default is a push to your own phone (your account id in SSM `moderators`). Do you also want email? SES is sandbox-only, so the address must be verified there.
6. **Ban scope:** answered (15 Nov 2026): a ban covers Walk buddies only; the person keeps counting steps and everything else.
7. **Country:** answered (15 Nov 2026): India only. The GDPR representative question is dropped. Gate:
   - the "Walk buddies" row shows only when the phone's region is India (`expo-localization` `regionCode === 'IN'`);
   - the server refuses `PUT /me/area` for an area code outside India's box (lat 6–37.5, lon 68–97.5) with 403 `not_available`;
   - the Start screen adds a third switch, "I live in India";
   - the terms say Walk buddies is for people in India.
8. **Deploy OK for T16a** and the push setup in 4.1.
9. **Log retention:** CERT-In asks for 180 days of logs in India. T16a sets 180 days for the two new Lambdas; OK to change the existing functions' `LOG_RETENTION` (one month today) to 180 days too? Small cost.
10. **Content rating answer:** default is "shares location with other users: yes (approximate area match only)". Check it against the questionnaire's wording when you fill it in.
11. **Sign-up record after leaving:** default keeps pid, handle, name and the join and 18+ dates for 180 days (IT Rules 3(1)(h) says "shall retain"). Check with the lawyer together with question 4.

### 11.2 Risks

| Risk | Handling |
|---|---|
| Family alert fires falsely when the watched person's phone has not sent steps | Wording "haven't come in"; the setup line says when steps are sent; T16g checks whether a background step upload exists and, if so, uses it |
| One `CLUBS` partition on `g1` for name search | gets a write only on club create, edit or member-count change (`lastMsgAt` lives on `LAST`, projections are `INCLUDE`); fine to thousands of clubs; shard by first letter if search gets slow |
| Polling shares the stage limit with step uploads and food | poll routes throttled to 20/40 (2.3), 30 s back-off on 429; switch to WebSocket, or raise the stage limit, when peak concurrent open chats pass about 100 (watch 4xx on the access log) |
| A banned person makes a new account | IT Rules 3(1)(h) require keeping registration data 180 days (`GONE#`, 5.7); T16a records the ban by `sub` only; owner question 6 decides whether a phone-number hash ban is wanted (privacy cost) |
| Nearby in thin areas could single someone out | lists show no area or distance; only people who turned it on; 20 lists a day; shuffled |
| Word list misses abuse in Telugu, Hindi and Hinglish | the owner adds words to SSM over time; reports catch the rest |
| Deletion of chat partitions and club messages runs after the request | the cron sweeps in pages within 15 minutes (longer for very large chats); reads already 404 or hide messages whose author is gone |
| `google-services.json` in a public repo | kept out; written from a GitHub secret in CI |
| Store review for user content | report, block, filter, terms switch, contact, deletion are all in; resubmit the content rating questionnaire when T16 ships |
| Under-18 users lie at the gate | self-declaration is the bar for now; `under18` reports lead to a ban |

## 12. Owner decisions (15 Nov 2026, testing phase)

- **No names, only handles.** Nobody sees another person's name anywhere (buddies, clubs, chat, plans, family, pushes). The `name` field is dropped; people are shown by handle (`pid` inside the app).
- **Anything that risks privacy is left out** of the test build; the rest is built.
- **Grievance Officer: Sathyavathi Katuri** (email `grievance@neutcrafts.in`). Other legal work waits until after testing.
- **A banned person can still see their own data** and can still ask to join other groups.
- **Nearby walkers and Walker family are kept**, each turned on only with the person's own consent (owner: consent removes the privacy risk).
- **A ban means removed from that one club only**; the person keeps everything else.
- **Walk routes are included in backup** (docs/data-sync.md).
- Push notifications wait until the owner has created the Firebase project.
