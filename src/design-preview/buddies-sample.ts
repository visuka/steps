/** Sample Walk buddies data for the design preview: no network. */
import type { SocialApi } from '@/buddies/api';
import { atDayTime } from '@/buddies/plans';
import { NOTIFY_DEFAULTS } from '@/buddies/read';
import type {
  Club,
  ClubCard,
  ClubGoals,
  ClubMember,
  ClubPage,
  ChatRow,
  Goal,
  GoalReport,
  GoalReportRow,
  GoalSummaryRow,
  Message,
  Plan,
  PlanInvitee,
  SocialMe,
  Walker,
} from '@/buddies/types';
import { addDaysToKey, dayKey } from '@/lib/dates';

const NOW = Date.now();
const MIN = 60_000;

const ravi: Walker = { pid: 'p1', handle: 'ravi_walks', name: 'Ravi', relation: 'buddy' };
const meera: Walker = { pid: 'p2', handle: 'meera.k', name: 'Meera', relation: 'buddy' };
const asha: Walker = { pid: 'p3', handle: 'asha_runs', name: 'Asha', relation: 'asked_me' };
// A real first name, so the rows read as a user sees them ("Kavya (you)"), not "You (you)".
const me: Walker = { pid: 'me', handle: 'you_walk', name: 'Kavya', relation: 'self' };
// Club people (docs/walk-buddies.md 7.5): one Telugu name, so the shot checks the font.
const lakshmi: Walker = { pid: 'p4', handle: 'lakshmi_k', name: 'లక్ష్మి', relation: 'buddy' };
const arjun: Walker = { pid: 'p5', handle: 'arjun22', name: null, relation: 'none' };
const meena: Walker = { pid: 'p6', handle: 'meena_walks', name: null, relation: 'none' };
const kiran: Walker = { pid: 'p7', handle: 'kiran_steps', name: null, relation: 'none' };
const sita: Walker = { pid: 'p8', handle: 'sita_walks', name: null, relation: 'none' };

/** The club the preview's club screens open (&id=KBR000000001): I am its captain, it has shared goals. */
export const SAMPLE_CLUB_ID = 'KBR000000001';
/** A club with shared goals I am not in yet: the goals consent screen (&id=NRS000000002). */
export const SAMPLE_GOALS_CLUB_ID = 'NRS000000002';

const KBR: Club = {
  clubId: SAMPLE_CLUB_ID,
  name: 'KBR Morning Walkers',
  area: 'Banjara Hills',
  memberCount: 48,
  myState: 'member',
  goals: true,
  captain: me,
  about: 'We walk the KBR Park loop at 6 every morning. All paces welcome.',
  hidden: false,
  myRole: 'owner',
  myBoard: true,
};

const NRS: Club = {
  clubId: SAMPLE_GOALS_CLUB_ID,
  name: 'Necklace Road Striders',
  area: 'Hussain Sagar',
  memberCount: 23,
  myState: 'none',
  goals: true,
  captain: lakshmi,
  about: 'Evening walks by the lake, 7 pm. Weekly step goals.',
  hidden: false,
  myRole: null,
  myBoard: false,
};

const JHE: Club = {
  clubId: 'JHE000000003',
  name: 'Jubilee Hills Evening Walk',
  area: 'Jubilee Hills',
  memberCount: 12,
  myState: 'invited',
  goals: false,
  captain: ravi,
  about: '',
  hidden: false,
  myRole: null,
  myBoard: false,
};

/** A club with goals where I said yes to goal tracking (&id=HPW000000004). */
export const SAMPLE_TRACKED_CLUB_ID = 'HPW000000004';
/** A club with goals I joined before goals were on: the tracking switch (&id=SRN000000005). */
export const SAMPLE_UNTRACKED_CLUB_ID = 'SRN000000005';

const HPW: Club = {
  clubId: SAMPLE_TRACKED_CLUB_ID,
  name: 'Hitech City Lunch Walk',
  area: 'Madhapur',
  memberCount: 31,
  myState: 'member',
  goals: true,
  captain: meera,
  about: 'A 20 minute walk after lunch, weekdays at 1:15.',
  hidden: false,
  myRole: 'member',
  myBoard: false,
};

const SRN: Club = {
  clubId: SAMPLE_UNTRACKED_CLUB_ID,
  name: 'Sanjeevaiah Park Seniors',
  area: 'Necklace Road',
  memberCount: 17,
  myState: 'member',
  goals: true,
  captain: ravi,
  about: 'Slow walks and stretches, 6:30 every morning.',
  hidden: false,
  myRole: 'member',
  myBoard: false,
};

const pageOf = (club: Club, members: ClubMember[]): ClubPage => ({ club, members });

const cardOf = ({ clubId, name, area, memberCount, myState, goals, captain }: Club): ClubCard => ({ clubId, name, area, memberCount, myState, goals, captain });

// Join times, so the captain's Leave dialog names who takes over: Ravi, the vice-captain who joined first.
const DAY = 1440 * MIN;
const KBR_MEMBERS: ClubMember[] = [
  { walker: me, role: 'owner', joinedAt: NOW - 400 * DAY },
  { walker: ravi, role: 'admin', joinedAt: NOW - 300 * DAY },
  { walker: lakshmi, role: 'member', joinedAt: NOW - 350 * DAY },
  { walker: arjun, role: 'member', joinedAt: NOW - 120 * DAY },
  { walker: meena, role: 'member', joinedAt: NOW - 40 * DAY },
];

const clubMsg = (id: string, from: Walker, text: string, ago: number): Message => ({
  id,
  mine: from.pid === 'me',
  from: { pid: from.pid, handle: from.handle, name: from.name },
  text,
  at: NOW - ago * MIN,
});

const CLUB_MESSAGES: Message[] = [
  clubMsg('c1', ravi, 'Gate 2 is closed this week, meet at the main gate.', 26 * 60),
  clubMsg('c2', lakshmi, 'రేపు ఉదయం 6 గంటలకు', 25 * 60),
  clubMsg('c3', me, 'See you all at 6.', 50),
  clubMsg('c4', arjun, 'Running 10 minutes late, start without me.', 12),
];

const CHATS: ChatRow[] = [
  { key: 'b.p1', kind: 'buddy', title: 'Ravi', lastAt: NOW - 8 * MIN, lastText: 'Park at 6:30 tomorrow?', lastMine: false, unread: 2 },
  { key: 'b.p2', kind: 'buddy', title: 'Meera', lastAt: NOW - 26 * 60 * MIN, lastText: '9,800 today, close!', lastMine: true, unread: 0 },
];

const msg = (id: string, mine: boolean, text: string, ago: number): Message => ({
  id,
  mine,
  from: mine ? { pid: 'me', handle: 'you_walk', name: 'Kavya' } : { pid: 'p1', handle: 'ravi_walks', name: 'Ravi' },
  text,
  at: NOW - ago * MIN,
});

const MESSAGES: Message[] = [
  msg('m1', false, 'Morning walk done?', 40),
  msg('m2', true, 'Yes, 6,200 before work.', 35),
  msg('m3', false, 'Nice. Park at 6:30 tomorrow?', 8),
];

// Walk plans (T16e): one I organise, one I'm invited to, one for the club.
const dayFromNow = (n: number) => addDaysToKey(dayKey(new Date(NOW)), n);

/** The plan I organise (&id=PLN000000001): a buddy plan, two going, one can't, one waiting. */
export const SAMPLE_PLAN_ID = 'PLN000000001';
/** A plan Ravi invited me to (&id=PLN000000002). */
export const SAMPLE_INVITED_PLAN_ID = 'PLN000000002';

const PLANS: Plan[] = [
  {
    planId: SAMPLE_PLAN_ID,
    organiser: me,
    club: null,
    startsAt: atDayTime(dayFromNow(1), 6 * 60 + 30),
    tz: 'Asia/Kolkata',
    place: 'KBR Park main gate',
    note: 'One loop, about 45 minutes. Water at the gate.',
    status: 'on',
    myAnswer: 'going',
    going: 2,
    notGoing: 1,
  },
  {
    planId: SAMPLE_INVITED_PLAN_ID,
    organiser: ravi,
    club: null,
    startsAt: atDayTime(dayFromNow(3), 18 * 60),
    tz: 'Asia/Kolkata',
    place: 'Necklace Road, Sanjeevaiah Park side',
    note: 'Easy pace, back by 7.',
    status: 'on',
    myAnswer: 'none',
    going: 1,
    notGoing: 0,
  },
  {
    planId: 'PLN000000003',
    organiser: ravi,
    club: { clubId: SAMPLE_CLUB_ID, name: 'KBR Morning Walkers' },
    startsAt: atDayTime(dayFromNow(5), 6 * 60),
    tz: 'Asia/Kolkata',
    place: 'KBR Park, gate 3',
    note: 'Sunday long walk, two loops.',
    status: 'on',
    myAnswer: 'going',
    going: 6,
    notGoing: 2,
  },
];

const INVITEES: Record<string, PlanInvitee[]> = {
  [SAMPLE_PLAN_ID]: [
    { walker: ravi, answer: 'going' },
    { walker: lakshmi, answer: 'going' },
    { walker: meera, answer: 'not_going' },
    { walker: { ...asha, relation: 'buddy' }, answer: 'none' },
  ],
  [SAMPLE_INVITED_PLAN_ID]: [
    { walker: me, answer: 'none' },
    { walker: meera, answer: 'going' },
  ],
  PLN000000003: [
    { walker: ravi, answer: 'going' },
    { walker: me, answer: 'going' },
    { walker: lakshmi, answer: 'going' },
    { walker: arjun, answer: 'not_going' },
  ],
};

// Shared club goals: KBR (I am captain), HPW (I am tracked), SRN (I am not tracked yet).
/** The goal the preview's goal screens open (&goal=GL0000000001): the morning walk, counted by the phone. */
export const SAMPLE_GOAL_ID = 'GL0000000001';
const everyDay = [0, 1, 2, 3, 4, 5, 6];
const goalOf = (
  goalId: string,
  title: string,
  kind: Goal['kind'],
  target: number | null,
  counted: Goal['counted'],
  byTime: string | null,
  days = everyDay,
  by: Walker = me,
): Goal => ({ goalId, title, kind, target, byTime, days, counted, paused: false, createdBy: by, createdAt: NOW - 20 * 1440 * MIN });
const at = (h: number, m: number) => {
  const d = new Date(NOW);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
};

const GOALS: Record<string, ClubGoals> = {
  [SAMPLE_CLUB_ID]: {
    goals: [
      goalOf(SAMPLE_GOAL_ID, 'Morning walk', 'walk', 30, 'auto', '07:00'),
      goalOf('GL0000000002', 'Daily steps', 'steps', 8000, 'auto', null),
      goalOf('GL0000000003', 'Morning tablet', 'medicine', null, 'tap', '09:00'),
      goalOf('GL0000000004', 'Drink water', 'water', 8, 'auto', null),
      goalOf('GL0000000005', 'Stretch for 10 minutes', 'other', null, 'tap', null, [0, 2, 4], ravi),
    ],
    tracked: true,
    mine: [
      { goalId: SAMPLE_GOAL_ID, done: true, at: at(6, 48), value: null },
      { goalId: 'GL0000000002', done: false, at: null, value: 6200 },
      { goalId: 'GL0000000003', done: true, at: at(8, 12), value: null },
    ],
  },
  [SAMPLE_TRACKED_CLUB_ID]: {
    goals: [
      goalOf('GL0000000011', 'Lunch walk', 'walk', 20, 'auto', '14:00', everyDay, meera),
      goalOf('GL0000000012', 'Sleep 7 hours', 'sleep', 420, 'auto', null, everyDay, meera),
      goalOf('GL0000000013', 'Evening tablet', 'medicine', null, 'tap', '20:00', everyDay, meera),
    ],
    tracked: true,
    mine: [],
  },
  [SAMPLE_UNTRACKED_CLUB_ID]: {
    goals: [goalOf('GL0000000021', 'Morning stretches', 'other', null, 'tap', '07:30', everyDay, ravi)],
    tracked: false,
    mine: [],
  },
};
const goalsOf = (id: string): ClubGoals => GOALS[id] ?? { goals: [], tracked: false, mine: [] };
const goalById = (id: string, goalId: string) => goalsOf(id).goals.find((g) => g.goalId === goalId) ?? GOALS[SAMPLE_CLUB_ID].goals[0];

const SUMMARY: GoalSummaryRow[] = [
  { goalId: SAMPLE_GOAL_ID, doneToday: 5, members: 7 },
  { goalId: 'GL0000000002', doneToday: 3, members: 7 },
  { goalId: 'GL0000000003', doneToday: 6, members: 7 },
  { goalId: 'GL0000000004', doneToday: 2, members: 7 },
  { goalId: 'GL0000000005', doneToday: 0, members: 7 },
];

const reportRow = (walker: Walker, role: GoalReportRow['role'], done: boolean, h: number, m: number, week: number, ever = true): GoalReportRow => ({
  walker,
  role,
  today: { done, at: done ? at(h, m) : null, value: null },
  week: { done: week, of: 7 },
  everDone: ever || done,
});

const REPORT_ROWS: GoalReportRow[] = [
  reportRow(arjun, 'member', false, 0, 0, 3),
  reportRow(kiran, 'member', false, 0, 0, 0, false),
  reportRow(lakshmi, 'member', true, 6, 35, 7),
  reportRow(meena, 'member', true, 6, 52, 5),
  reportRow(ravi, 'admin', true, 6, 20, 6),
  reportRow(sita, 'member', true, 6, 41, 4),
  reportRow(me, 'owner', true, 6, 48, 6),
];

const reportOf = (id: string, goalId: string, day: string): GoalReport => ({
  day,
  goal: goalById(id, goalId),
  members: REPORT_ROWS.length,
  doneToday: REPORT_ROWS.filter((r) => r.today.done).length,
  neverDone: REPORT_ROWS.filter((r) => !r.everDone).length,
  rows: REPORT_ROWS,
});

const SAMPLE_ME: SocialMe = {
  joined: true,
  pid: 'me',
  handle: 'you_walk',
  name: 'Kavya',
  handleChangeFrom: 0,
  nearby: false,
  areaSetOn: null,
  counts: { requestsIn: 1, unread: 2, clubInvites: 0, clubRequests: 0 },
  notify: { ...NOTIFY_DEFAULTS },
};

const planById = (id: string) => PLANS.find((p) => p.planId === id) ?? PLANS[0];

const ok = async () => undefined;

export const SAMPLE_SOCIAL_API: SocialApi = {
  me: async () => SAMPLE_ME,
  join: async () => SAMPLE_SOCIAL_API.me(),
  updateMe: async (p) =>
    SAMPLE_ME.joined ? { ...SAMPLE_ME, notify: { ...(SAMPLE_ME.notify ?? NOTIFY_DEFAULTS), ...(p.notify ?? {}) } } : SAMPLE_ME,
  leave: ok,
  findWalker: async () => ravi,
  setArea: ok,
  clearArea: ok,
  nearby: async () => ({ walkers: [], areaSetOn: null }),
  requests: async () => ({
    incoming: [{ walker: asha, at: NOW - 90 * MIN }],
    outgoing: [],
    clubInvites: [{ club: cardOf(JHE), by: ravi, at: NOW - 3 * 60 * MIN }],
  }),
  ask: async () => 'requested',
  accept: ok,
  decline: ok,
  cancel: ok,
  buddies: async () => [
    { walker: ravi, since: NOW - 30 * 1440 * MIN },
    { walker: meera, since: NOW - 12 * 1440 * MIN },
  ],
  removeBuddy: ok,
  chats: async () => CHATS,
  messages: async (key) => ({ messages: key.startsWith('c.') ? CLUB_MESSAGES : MESSAGES, more: false }),
  send: async (_key, text, clientId) => ({ ...msg(clientId, true, text, 0), clientId }),
  read: ok,
  deleteMessage: ok,
  block: ok,
  report: ok,

  searchClubs: async () => [cardOf(KBR), cardOf(NRS), { ...cardOf(JHE), myState: 'asked' }],
  // GET /clubs/mine with my role on each card: Captain (KBR), Vice-captain (JHE), Member (HPW, SRN).
  myClubs: async () => [
    { ...cardOf(KBR), myRole: 'owner' },
    { ...cardOf(JHE), myState: 'member', myRole: 'admin' },
    { ...cardOf(HPW), myRole: 'member' },
    { ...cardOf(SRN), myRole: 'member' },
  ],
  club: async (id) => {
    switch (id) {
      case SAMPLE_GOALS_CLUB_ID:
        return pageOf(NRS, []);
      case JHE.clubId:
        return pageOf(JHE, []);
      case HPW.clubId:
        return pageOf(HPW, []);
      case SRN.clubId:
        return pageOf(SRN, []);
      default:
        return pageOf(KBR, KBR_MEMBERS);
    }
  },
  createClub: async () => KBR,
  updateClub: async () => KBR,
  deleteClub: ok,
  joinClub: async () => 'asked',
  cancelJoin: ok,
  acceptClubInvite: async () => ({ ...JHE, myState: 'member', myRole: 'member' }),
  declineClubInvite: ok,
  clubRequests: async () => [
    { walker: kiran, at: NOW - 40 * MIN },
    { walker: sita, at: NOW - 5 * 60 * MIN },
  ],
  approveRequest: ok,
  declineRequest: ok,
  inviteBuddy: ok,
  setRole: ok,
  removeMember: ok,
  leaveClub: ok,
  setBoard: ok,
  board: async () => ({
    weekStart: '2026-11-23',
    rows: [
      { walker: ravi, weekSteps: 52340 },
      { walker: me, weekSteps: 41200 },
      { walker: lakshmi, weekSteps: 38900 },
      { walker: meena, weekSteps: 21050 },
    ],
  }),
  clubReports: async () => [{ reportId: 'R1', kind: 'message', reason: 'spam', text: 'Cheap walking shoes, message me for the price', at: NOW - 2 * 60 * MIN }],
  closeClubReport: ok,
  newClubCode: async () => ({ code: 'K7QM2XPA', codeExpiresAt: NOW + 48 * 60 * MIN }),
  clubByCode: async () => cardOf(NRS),
  putSteps: async () => true,

  plans: async () => PLANS,
  plan: async (id) => ({ plan: planById(id), invitees: INVITEES[planById(id).planId] ?? [] }),
  createPlan: async (f) => ({ ...PLANS[0], startsAt: f.startsAt, place: f.place, note: f.note }),
  updatePlan: async (id, p) => ({ ...planById(id), ...(p.startsAt ? { startsAt: p.startsAt } : {}), ...(p.place ? { place: p.place } : {}) }),
  cancelPlan: async (id) => ({ ...planById(id), status: 'cancelled' }),
  answerPlan: async (id, answer) => ({ ...planById(id), myAnswer: answer }),

  clubGoals: async (id) => goalsOf(id),
  createGoal: async (_id, f) => ({ ...goalOf('GL0000000099', f.title, f.kind, f.target, f.counted, f.byTime, f.days), createdAt: NOW }),
  updateGoal: async (id, goalId, p) => {
    const g = goalById(id, goalId);
    return {
      ...g,
      title: p.title ?? g.title,
      target: p.target === undefined ? g.target : p.target,
      byTime: p.byTime === undefined ? g.byTime : p.byTime,
      days: p.days ?? g.days,
      paused: p.paused ?? g.paused,
    };
  },
  deleteGoal: ok,
  putMark: async (_id, goalId, day, m) => ({ goalId, day, done: m.done, at: m.done ? Date.now() : null, value: m.value ?? null }),
  goalReport: async (id, goalId, day) => reportOf(id, goalId, day),
  goalSummary: async (id) => (id === SAMPLE_CLUB_ID ? SUMMARY : []),
  remindGoal: ok,
  setGoalsConsent: ok,
};
