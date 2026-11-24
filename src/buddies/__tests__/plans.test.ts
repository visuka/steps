import { describe, expect, it, jest } from '@jest/globals';

import {
  answerAndRemind,
  atDayTime,
  dayChoices,
  defaultStart,
  inviteeGroups,
  type Kv,
  markTipsSeen,
  minutesOf,
  PLAN_REMINDERS_KEY,
  planCounts,
  planErrorText,
  planLine,
  planProblem,
  type Reminders,
  reminderAt,
  syncReminders,
  tipsSeen,
  TIPS_KEY,
  standWord,
  upcoming,
} from '../plans';
import { SocialError, socialErrorFor } from '../read';
import type { Plan, PlanInvitee, Walker } from '../types';

const H = 3_600_000;
// Sat 14 Nov 2026, 3:45 pm local (the preview clock).
const NOW = new Date(2026, 10, 14, 15, 45).getTime();
const style = { uses24h: false, locale: 'en-GB' } as const;

const ravi: Walker = { pid: 'P1', handle: 'ravi_walks', name: 'Ravi', relation: 'buddy' };
const me: Walker = { pid: 'P0', handle: 'you_walk', name: 'You', relation: 'self' };

const plan = (over: Partial<Plan> = {}): Plan => ({
  planId: 'PLN000000001',
  organiser: ravi,
  club: null,
  startsAt: NOW + 24 * H,
  tz: 'Asia/Kolkata',
  place: 'KBR Park',
  note: '',
  status: 'on',
  myAnswer: 'going',
  going: 2,
  notGoing: 1,
  ...over,
});

function memKv(start: Record<string, unknown> = {}): Kv & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = { ...start };
  return {
    data,
    getKv: async <T,>(k: string) => (k in data ? (data[k] as T) : null),
    setKv: async <T,>(k: string, v: T) => {
      data[k] = v;
    },
  };
}

function fakeReminders(granted = true) {
  let n = 0;
  const schedule = jest.fn<Reminders['schedule']>(async () => (granted ? `n${++n}` : null));
  const cancel = jest.fn<Reminders['cancel']>(async () => undefined);
  return { schedule, cancel };
}

describe('the form', () => {
  it('offers today, tomorrow and 5 more days', () => {
    const days = dayChoices(NOW);
    expect(days).toHaveLength(7);
    expect(days.slice(0, 3).map((d) => d.label)).toEqual(['Today', 'Tomorrow', 'Mon 16']);
    expect(days[0].day).toBe('2026-11-14');
    expect(days[6].day).toBe('2026-11-20');
  });

  it('starts tomorrow at 7:00, and builds day + time', () => {
    expect(defaultStart(NOW)).toBe(new Date(2026, 10, 15, 7, 0).getTime());
    expect(atDayTime('2026-11-20', 18 * 60 + 30)).toBe(new Date(2026, 10, 20, 18, 30).getTime());
    expect(minutesOf(new Date(2026, 10, 20, 18, 30).getTime())).toBe(18 * 60 + 30);
  });

  const good = { startsAt: NOW + 24 * H, place: 'KBR Park', note: '', invite: ['P1'], clubId: null };

  it('passes a good plan', () => {
    expect(planProblem(good, NOW)).toBeNull();
    expect(planProblem({ ...good, invite: [], clubId: 'KBR000000001' }, NOW)).toBeNull();
  });

  it("says what's wrong in plain words", () => {
    expect(planProblem({ ...good, place: '   ' }, NOW)).toBe("Type where you'll meet.");
    expect(planProblem({ ...good, place: 'x'.repeat(61) }, NOW)).toMatch(/60 characters/);
    expect(planProblem({ ...good, place: `${'x'.repeat(30)}     ${'y'.repeat(29)}` }, NOW)).toBeNull();
    expect(planProblem({ ...good, note: 'x'.repeat(201) }, NOW)).toMatch(/200 characters/);
    expect(planProblem({ ...good, startsAt: NOW + 10 * 60_000 }, NOW)).toMatch(/15 minutes/);
    expect(planProblem({ ...good, startsAt: NOW + 61 * 24 * H }, NOW)).toMatch(/60 days/);
    expect(planProblem({ ...good, invite: [] }, NOW)).toBe('Invite at least one buddy.');
    expect(planProblem({ ...good, invite: Array.from({ length: 21 }, (_, i) => `P${i}`) }, NOW)).toMatch(/up to 20/);
  });

  it('lets a change keep the same buddies', () => {
    expect(planProblem({ ...good, invite: [] }, NOW, { editing: true })).toBeNull();
  });
});

describe('words and numbers', () => {
  const invitees: PlanInvitee[] = [
    { walker: { ...ravi, name: 'Zoya', pid: 'P9' }, answer: 'going' },
    { walker: ravi, answer: 'going' },
    { walker: { ...ravi, pid: 'P2', name: null, handle: 'meera.k' }, answer: 'not_going' },
    { walker: { ...ravi, pid: 'P3', name: 'Asha' }, answer: 'none' },
  ];

  it('groups who said what, by name', () => {
    const g = inviteeGroups(invitees);
    expect(g.going.map((i) => i.walker.name)).toEqual(['Ravi', 'Zoya']);
    expect(g.not_going).toHaveLength(1);
    expect(g.none).toHaveLength(1);
  });

  it('counts waiting for buddy plans only', () => {
    expect(planCounts(plan(), invitees)).toEqual({ going: 2, notGoing: 1, waiting: 1 });
    expect(planCounts(plan({ club: { clubId: 'KBR000000001', name: 'KBR' } }), invitees).waiting).toBeNull();
  });

  it('writes the row line', () => {
    expect(planLine(plan({ startsAt: new Date(2026, 10, 15, 6, 30).getTime() }), NOW, style)).toBe('Tomorrow, 6:30 am · 2 going');
    expect(planLine(plan({ startsAt: new Date(2026, 10, 14, 18, 0).getTime(), going: 0 }), NOW, style)).toBe('Today, 6:00 pm');
    expect(planLine(plan({ status: 'cancelled', startsAt: new Date(2026, 10, 15, 6, 30).getTime() }), NOW, style)).toBe('Tomorrow, 6:30 am · Cancelled');
  });

  it('says where I stand on each row', () => {
    expect(standWord(plan({ organiser: me }))).toBe('Yours');
    expect(standWord(plan({ myAnswer: 'none' }))).toBe('Invited');
    expect(standWord(plan({ myAnswer: 'going' }))).toBe('Going');
    expect(standWord(plan({ myAnswer: 'not_going' }))).toBe("Can't make it");
    expect(standWord(plan({ status: 'cancelled' }))).toBe('');
  });

  it('keeps upcoming plans, soonest first', () => {
    const list = upcoming([plan({ planId: 'B', startsAt: NOW + 5 * H }), plan({ planId: 'A', startsAt: NOW + H }), plan({ planId: 'old', startsAt: NOW - 2 * H })], NOW);
    expect(list.map((p) => p.planId)).toEqual(['A', 'B']);
  });

  it('turns errors into plain words', () => {
    expect(planErrorText(socialErrorFor(429, 'daily_limit'))).toMatch(/5 upcoming walks/);
    expect(planErrorText(socialErrorFor(400, 'bad_request', 'startsAt'))).toMatch(/15 minutes/);
    expect(planErrorText(socialErrorFor(400, 'bad_request', 'invite'))).toMatch(/buddies/);
    expect(planErrorText(socialErrorFor(409, 'conflict'))).toBe('This walk was cancelled.');
    expect(planErrorText(socialErrorFor(404, 'not_found'))).toBe("This walk isn't there any more.");
    expect(planErrorText(new SocialError('offline'))).toMatch(/offline/);
    expect(planErrorText(new Error('x'))).toBe('Something went wrong. Try again.');
  });
});

describe('the reminder 1 hour before', () => {
  it('reminds only when going, on, and more than an hour away', () => {
    expect(reminderAt(plan(), NOW)).toBe(NOW + 23 * H);
    expect(reminderAt(plan({ myAnswer: 'not_going' }), NOW)).toBeNull();
    expect(reminderAt(plan({ myAnswer: 'none' }), NOW)).toBeNull();
    expect(reminderAt(plan({ status: 'cancelled' }), NOW)).toBeNull();
    expect(reminderAt(plan({ startsAt: NOW + 30 * 60_000 }), NOW)).toBeNull();
  });

  it('schedules one, with neutral words, and does not schedule it twice', async () => {
    const kv = memKv();
    const r = fakeReminders();
    const p = plan({ startsAt: new Date(2026, 10, 15, 6, 30).getTime() });
    const set = await syncReminders({ kv, reminders: r, now: NOW, style }, [p]);
    expect(set.has(p.planId)).toBe(true);
    expect(r.schedule).toHaveBeenCalledWith(p.startsAt - H, 'Walk in 1 hour', 'KBR Park, 6:30 am', false);
    await syncReminders({ kv, reminders: r, now: NOW, style }, [p]);
    expect(r.schedule).toHaveBeenCalledTimes(1);
    expect(r.cancel).not.toHaveBeenCalled();
  });

  it('moves it when the time changes and drops it when cancelled', async () => {
    const kv = memKv();
    const r = fakeReminders();
    await syncReminders({ kv, reminders: r, now: NOW, style }, [plan()]);
    await syncReminders({ kv, reminders: r, now: NOW, style }, [plan({ startsAt: NOW + 30 * H })]);
    expect(r.cancel).toHaveBeenCalledWith('n1');
    expect(r.schedule).toHaveBeenCalledTimes(2);
    const set = await syncReminders({ kv, reminders: r, now: NOW, style }, [plan({ status: 'cancelled' })]);
    expect(r.cancel).toHaveBeenLastCalledWith('n2');
    expect(set.size).toBe(0);
    expect(kv.data[PLAN_REMINDERS_KEY]).toEqual({});
  });

  it('with the whole list, drops reminders for plans that are gone', async () => {
    const kv = memKv({ [PLAN_REMINDERS_KEY]: { GONE: { id: 'old', at: NOW + H, place: 'x' } } });
    const r = fakeReminders();
    await syncReminders({ kv, reminders: r, now: NOW, style }, [plan()], { all: true });
    expect(r.cancel).toHaveBeenCalledWith('old');
    expect(Object.keys(kv.data[PLAN_REMINDERS_KEY] as object)).toEqual(['PLN000000001']);
  });

  it('keeps nothing when notifications are off', async () => {
    const kv = memKv();
    const set = await syncReminders({ kv, reminders: fakeReminders(false), now: NOW, style }, [plan()]);
    expect(set.size).toBe(0);
  });

  it('ignores a broken saved map', async () => {
    const kv = memKv({ [PLAN_REMINDERS_KEY]: ['junk'] });
    const set = await syncReminders({ kv, reminders: fakeReminders(), now: NOW, style }, [plan()]);
    expect(set.size).toBe(1);
  });

  it('answering Going asks for notifications and sets the reminder; Can\'t make it drops it', async () => {
    const kv = memKv();
    const r = fakeReminders();
    const answerPlan = jest.fn(async (_id: string, a: 'going' | 'not_going') => plan({ myAnswer: a }));
    const going = await answerAndRemind({ kv, reminders: r, now: NOW, style, answerPlan }, 'PLN000000001', 'going');
    expect(going.reminded).toBe(true);
    expect(r.schedule.mock.calls[0][3]).toBe(true);
    const not = await answerAndRemind({ kv, reminders: r, now: NOW, style, answerPlan }, 'PLN000000001', 'not_going');
    expect(not.reminded).toBe(false);
    expect(r.cancel).toHaveBeenCalledWith('n1');
  });

  it('organiser plans count as going', () => {
    expect(reminderAt(plan({ organiser: me }), NOW)).toBe(NOW + 23 * H);
  });
});

describe('safety tips', () => {
  it('are shown once per kind', async () => {
    const kv = memKv();
    expect(await tipsSeen(kv, 'plan')).toBe(false);
    await markTipsSeen(kv, 'plan');
    expect(await tipsSeen(kv, 'plan')).toBe(true);
    expect(await tipsSeen(kv, 'club')).toBe(false);
    await markTipsSeen(kv, 'club');
    expect(kv.data[TIPS_KEY]).toEqual({ plan: true, club: true });
  });
});
