# Design rules audit — your Master Prompt (18 Nov 2026)

**Copied into the project on 18 Nov 2026.** Changes since the first version:
- The rules now live in `.claude/rules/visual-design.md`. Claude Code loads that file automatically, and `CLAUDE.md` points to it.
- One correction: the plain look's colour and size values (`plain-theme.ts`) and its shared pieces (`plain-kit.tsx`) already existed, built on 17 Nov before your prompt.
- A new section 5 measures the built app against the contrast rule.

## 1. What I saved for myself after your prompt

I saved **one note**, and only after you said "Yuck" to the revamp:

> When a pasted design brief conflicts with the owner's approved look, mock the approved look improved by the brief's points (readability, consistency, tokens), not a new style. Show 2–3 clearly different directions side by side.

**That is all.** I did **not**:
- write your 20 mandatory rules down as a checklist;
- create `CLAUDE.md` design rules or the six `.claude/rules/*.md` files your prompt asked for (none existed until this copy);
- extend the tokens and reusable pieces your prompt asked for. The plain look's own values (`plain-theme.ts`) and pieces (`plain-kit.tsx`) were built on 17 Nov, before your prompt, and haven't changed since;
- build the sage-tiles changes into the app, even though I said I would after "I want both 1 and 2". The last commit was 18 Nov, 07:37; your prompt came at 08:47, and nothing has been committed since.

The older notes (tiles look, premium look, soft colours) are long histories of what you said, not a short rule list. During the colour rounds (P to AD) I followed each new wish and dropped rules I had already agreed. That's why you had to keep checking.

## 2. Your prompt, point by point

✅ = adopted · 🔶 = adapted to your choices · ⛔ = set aside because you chose otherwise · ❌ = adopted but not done yet

| # | Your prompt says | Verdict | Why |
|---|---|---|---|
| 1 | Inspect the project first | ✅ | Done before the revamp mock. |
| 2 | Install visual packages (NativeWind, Tamagui, Reusables, Moti, Skia, Rive…) | ⛔ mostly | The app already has its own theme. Tamagui, NativeWind or Reusables would be a second, competing system. Skia and Rive aren't needed. I proposed only Lucide icons and installed nothing, since you choose packages. |
| 3 | Quiet luxury, minimal not empty, warm not sterile | ✅ | Same as your 17 Nov premium brief. |
| 4.1, 4.2, 4.5, 4.8, 4.11–4.13 | Focal point, asymmetry, alignment, comfortable density, never fill space, no extra scrolling, whole-screen view | ✅ | Matches your rules: ads space stays empty, Today never scrolls. |
| 4.3, 4.6, 4.9 | Open layouts, dividers instead of cards, avoid repeated tiles | ⛔ | You chose tiles on 17 Nov and said "Yuck" to the open look on 18 Nov. |
| 4.10 / 7 | Avoid heavy rounding and "glassmorphism everywhere" | 🔶 | Frosted glass tiles are your pick. I keep them but with moderate corners, soft shadows and no nesting. |
| 5 | Type scale, tabular numbers, careful weights, no huge type | 🔶 | Scale: yes. You asked for a big steps tile with bolder numbers, so the number is 88 on Activity, balanced inside its tile. ❌ Tabular numbers are not set in the mock yet. |
| 5 | Avoid too many uppercase labels | 🔶 | I tried sentence case in the revamp and you rejected it. The three-part switch stays in small capitals. Tile labels can follow either. |
| 6 | Warm neutral ground, charcoal text, muted accent | 🔶 | Soft grey ground with white glass is your pick, not warm paper. Charcoal text and muted sage: yes. |
| 6 | Never more than one accent colour at a time | 🔶 | You chose two: sage and sand. The checker allows at most two surface colours. |
| 6 | Light **and dark** themes | ⛔ for now | Your rule: light designs stay light unless you approve a dark version. |
| 6 | Enough contrast | ✅ | Now checked by script. Sage was deepened to #567565 so white words read. |
| 8 | Indicators allowed when useful (rings and bars only if justified) | ⛔ | Your rule is stricter: numbers and words only, no bars at all. |
| 9 | Same stroke, size and weight for every icon; no emoji | ✅ | |
| 9 | Few accent colours on icons | ⛔ | You asked for each icon in its own colour (water blue, sleep indigo, food orange…). |
| 10 | Motion tokens, gentle transitions, reduced-motion support | ✅ | |
| 10 | Avoid constant decorative movement | ⛔ | You asked for subtle continuous movement on 17 Nov. It stays slow and switches off with the phone's reduce-motion setting. |
| 11 | Central tokens and reusable pieces, no hard-coded values | 🔶 | They exist for the plain look: `src/components/plain/plain-theme.ts` and `plain-kit.tsx` (17 Nov). It isn't yet a shared system for other apps. |
| 12 | `CLAUDE.md` plus six rule files | ✅ now | Created on 18 Nov after this audit. I made one file, `.claude/rules/visual-design.md`, not six: one list is easier to keep free of contradictions. `CLAUDE.md` points to it. |
| 13 | 10-point visual score; never claim checked without rendering | 🔶 | I render every mock. A script now checks the measurable rules (0 problems on d37). The 10-point score isn't done yet. |
| 14 | Separate preview first; don't redesign screens yet | ✅ | Every look is mocked first. |
| 15 | Final report (packages, tokens, rules…) | ❌ | Never given, because the revamp was rejected. |

### Your 20 mandatory rules
- ✅ **Adopted (16):** rules 1, 2, 6–12 and 14–20.
- ⛔ **Set aside (2), because you chose tiles:** rule 3 (no repeated tiles) and rule 4 (fewer cards).
- 🔶 **Adapted (2):**
  - Rule 5 (no giant number in empty space): the number is big because you asked, but it sits balanced in its tile.
  - Rule 13 (no animation without a reason): the movement is there because you asked for it.

## 3. What is wrong with the prompt for this project

1. **Four points contradict your own choices:** open layout, no tiles, few icon colours and no constant motion. Followed literally, they produce the look you called "Yuck".
2. **It suggests a package system.** The app already works without one, and switching would risk features.
3. **It asks for dark mode.** You haven't approved a dark look.
4. **It is written for many apps.** Steps needs its own fixed decisions: sage + sand, tiles, no bars, three parts, no bottom bar.

## 4. Fixed now

- **One short rule list** that merges your prompt with your choices. It is saved in two places:
  - in the project, as `.claude/rules/visual-design.md`, so it loads in every Claude Code session here;
  - in my memory.
- **A rule-check script** runs before I send anything: 9 screens, small phone and large text. Look d37 passes with 0 problems.

## 5. The built app against these rules (measured 18 Nov)

The plain look in the app (`plain-theme.ts`, built 17 Nov) was made before the contrast rule was checked. Some small text is too faint:

| Where | Colours | Contrast | Needed |
|---|---|---|---|
| Grey labels and notes on a plain tile | #8E8E93 on #F8F8F9 | 3.07 | 4.5 |
| Grey labels on the sage top tile | #8E8E93 on #DEE4E2 | 2.53 | 4.5 |
| Grey labels on the sand tile | #8E8E93 on #F2EAE1 | 2.74 | 4.5 |
| White words on sage buttons | #FFFFFF on #5E7E6F | 4.48 | 4.5 |
| White count on sand badges | #FFFFFF on #C9A47C | 2.31 | 4.5 |
| Main words and numbers | #2C2C2E on #F8F8F9 | 13.13 | 4.5 ✅ |

The d37 mock fixes these with a darker grey, sage #567565 and badges #876644. Nothing in the app has been changed yet; that waits for your OK.
