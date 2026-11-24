import { describe, expect, it } from '@jest/globals';

import { readPlan, readPlanPage, readPlanReply, readPlans } from '../plans-read';
import { SocialError } from '../read';

const ravi = { pid: 'P1RAVI000000', handle: 'ravi_walks', name: 'Ravi', relation: 'buddy' };
const me = { pid: 'P0ME00000000', handle: 'you_walk', name: 'You', relation: 'self' };
const plan = {
  planId: 'PLN000000001',
  organiser: ravi,
  club: null,
  startsAt: 1_800_000_000_000,
  tz: 'Asia/Kolkata',
  place: 'KBR Park main gate',
  note: 'One loop.',
  status: 'on',
  myAnswer: 'going',
  going: 2,
  notGoing: 1,
};

describe('a plan', () => {
  it('reads a good plan', () => {
    expect(readPlan(plan)).toEqual({ ...plan, club: null });
  });

  it('reads a club plan with its club', () => {
    const p = readPlan({ ...plan, club: { clubId: 'KBR000000001', name: 'KBR Morning Walkers' } });
    expect(p.club).toEqual({ clubId: 'KBR000000001', name: 'KBR Morning Walkers' });
  });

  it('falls back on odd fields', () => {
    const p = readPlan({ ...plan, club: { clubId: '../x', name: 'Bad' }, status: 'maybe', myAnswer: 'yes', going: -2, notGoing: 'x', note: 7, tz: null });
    expect(p.club).toBeNull();
    expect(p.status).toBe('on');
    expect(p.myAnswer).toBe('none');
    expect(p.going).toBe(0);
    expect(p.notGoing).toBe(0);
    expect(p.note).toBe('');
    expect(p.tz).toBe('');
  });

  it('keeps cancelled', () => {
    expect(readPlan({ ...plan, status: 'cancelled' }).status).toBe('cancelled');
  });

  it("says the organiser is going even if the server doesn't", () => {
    expect(readPlan({ ...plan, organiser: me, myAnswer: 'none' }).myAnswer).toBe('going');
  });

  it('throws on a broken plan', () => {
    expect(() => readPlan(null)).toThrow(SocialError);
    expect(() => readPlan({ ...plan, planId: 'bad id!' })).toThrow(SocialError);
    expect(() => readPlan({ ...plan, organiser: { pid: 3 } })).toThrow(SocialError);
    expect(() => readPlan({ ...plan, place: '' })).toThrow(SocialError);
    expect(() => readPlan({ ...plan, startsAt: 'soon' })).toThrow(SocialError);
  });
});

describe('lists and replies', () => {
  it('sorts the list soonest first and leaves out broken rows', () => {
    const later = { ...plan, planId: 'PLN000000002', startsAt: plan.startsAt + 1000 };
    const list = readPlans({ plans: [later, { planId: 'x' }, plan] });
    expect(list.map((p) => p.planId)).toEqual(['PLN000000001', 'PLN000000002']);
  });

  it('throws when the list is missing', () => {
    expect(() => readPlans({})).toThrow(SocialError);
    expect(() => readPlans(null)).toThrow(SocialError);
  });

  it('reads {plan} replies', () => {
    expect(readPlanReply({ plan }).planId).toBe('PLN000000001');
    expect(() => readPlanReply({})).toThrow(SocialError);
  });

  it('reads the page with invitees, once each, odd answers as waiting', () => {
    const page = readPlanPage({
      plan,
      invitees: [
        { walker: ravi, answer: 'going' },
        { walker: ravi, answer: 'not_going' },
        { walker: { ...ravi, pid: 'P2MEERA00000', handle: 'meera.k' }, answer: 'perhaps' },
        { walker: { pid: 9 }, answer: 'going' },
        'junk',
      ],
    });
    expect(page.invitees).toHaveLength(2);
    expect(page.invitees[0].answer).toBe('going');
    expect(page.invitees[1].answer).toBe('none');
  });

  it('reads a page without invitees', () => {
    expect(readPlanPage({ plan }).invitees).toEqual([]);
  });
});
