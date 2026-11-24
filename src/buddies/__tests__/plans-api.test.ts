import { describe, expect, it, jest } from '@jest/globals';

import type { Send } from '../clubs-api';
import { makePlansApi } from '../plans-api';

const ravi = { pid: 'P1RAVI000000', handle: 'ravi_walks', name: 'Ravi', relation: 'buddy' };
const plan = {
  planId: 'PLN000000001',
  organiser: ravi,
  club: null,
  startsAt: 1_800_000_000_000,
  tz: 'Asia/Kolkata',
  place: 'KBR Park',
  note: '',
  status: 'on',
  myAnswer: 'none',
  going: 0,
  notGoing: 0,
};

function fake(reply: unknown = { plan }) {
  const send = jest.fn<Send>(async () => reply);
  return { send, api: makePlansApi(send) };
}

describe('plan calls', () => {
  it('lists plans and gets one', async () => {
    const { send, api } = fake({ plans: [plan] });
    expect(await api.plans()).toHaveLength(1);
    expect(send).toHaveBeenCalledWith('GET', '/plans');
    const one = fake({ plan, invitees: [] });
    await one.api.plan('PLN000000001');
    expect(one.send).toHaveBeenCalledWith('GET', '/plans/PLN000000001');
  });

  it('creates a buddy plan: tidy place, no empty note, each buddy once', async () => {
    const { send, api } = fake();
    await api.createPlan({ startsAt: 1_800_000_000_000, place: '  KBR   Park ', note: '  ', invite: ['P1', 'P2', 'P1'], clubId: null }, 'Asia/Kolkata');
    expect(send).toHaveBeenCalledWith('POST', '/plans', { startsAt: 1_800_000_000_000, tz: 'Asia/Kolkata', place: 'KBR Park', invite: ['P1', 'P2'] });
  });

  it('creates a club plan with the club and no invite list', async () => {
    const { send, api } = fake();
    await api.createPlan({ startsAt: 1_800_000_000_000, place: 'KBR Park', note: 'Two loops', invite: ['P1'], clubId: 'KBR000000001' }, 'Asia/Kolkata');
    expect(send).toHaveBeenCalledWith('POST', '/plans', { startsAt: 1_800_000_000_000, tz: 'Asia/Kolkata', place: 'KBR Park', note: 'Two loops', clubId: 'KBR000000001' });
  });

  it('changes only what is given; new buddies only when there are some', async () => {
    const { send, api } = fake();
    await api.updatePlan('PLN000000001', { place: ' Gate 3 ', invite: [] });
    expect(send).toHaveBeenLastCalledWith('PATCH', '/plans/PLN000000001', { place: 'Gate 3' });
    await api.updatePlan('PLN000000001', { startsAt: 1_800_000_100_000, note: '', invite: ['P3', 'P3'] });
    expect(send).toHaveBeenLastCalledWith('PATCH', '/plans/PLN000000001', { startsAt: 1_800_000_100_000, note: '', invite: ['P3'] });
  });

  it('cancels and answers', async () => {
    const { send, api } = fake({ plan: { ...plan, status: 'cancelled' } });
    expect((await api.cancelPlan('PLN000000001')).status).toBe('cancelled');
    expect(send).toHaveBeenLastCalledWith('POST', '/plans/PLN000000001/cancel');
    await api.answerPlan('PLN000000001', 'not_going');
    expect(send).toHaveBeenLastCalledWith('PUT', '/plans/PLN000000001/answer', { answer: 'not_going' });
  });

  it('puts odd ids safely in the link', async () => {
    const { send, api } = fake();
    await api.answerPlan('a/b', 'going');
    expect(send).toHaveBeenLastCalledWith('PUT', '/plans/a%2Fb/answer', { answer: 'going' });
  });

  it('throws on a broken answer', async () => {
    const { api } = fake({ nope: true });
    await expect(api.cancelPlan('PLN000000001')).rejects.toThrow();
  });
});
