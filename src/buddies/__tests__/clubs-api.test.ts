import { describe, expect, it, jest } from '@jest/globals';

import { makeClubsApi, type Send } from '../clubs-api';

const ravi = { pid: 'P1RAVI000000', handle: 'ravi_walks', name: 'Ravi', relation: 'buddy' };
const card = { clubId: 'KBR000000001', name: 'KBR Morning Walkers', area: 'Banjara Hills', memberCount: 48, myState: 'member', goals: true, captain: ravi };

/** A fake `send` that answers `reply` and remembers every call. */
function fake(reply: unknown = null) {
  const send = jest.fn<Send>(async () => reply);
  return { send, api: makeClubsApi(send) };
}

describe('club calls', () => {
  it('searches with the query in the link and reads the cards', async () => {
    const { send, api } = fake({ clubs: [card] });
    const list = await api.searchClubs(' kbr park ');
    expect(send).toHaveBeenCalledWith('GET', '/clubs?q=kbr%20park');
    expect(list[0].goals).toBe(true);
  });

  it('lists my clubs and gets one with its members', async () => {
    const { send, api } = fake({ club: { ...card, myRole: 'owner' }, members: [{ walker: ravi, role: 'owner' }] });
    const page = await api.club('KBR000000001');
    expect(send).toHaveBeenCalledWith('GET', '/clubs/KBR000000001');
    expect(page.members).toHaveLength(1);
    const mine = fake({ clubs: [] });
    await mine.api.myClubs();
    expect(mine.send).toHaveBeenCalledWith('GET', '/clubs/mine');
  });

  it('creates a club with the goals flag, trimmed', async () => {
    const { send, api } = fake({ club: { ...card, myRole: 'owner' } });
    await api.createClub({ name: ' KBR ', area: ' Banjara Hills ', about: '', hidden: false, goals: true });
    expect(send).toHaveBeenCalledWith('POST', '/clubs', { name: 'KBR', area: 'Banjara Hills', about: '', hidden: false, goals: true });
  });

  it('patches only what changed, goals included', async () => {
    const { send, api } = fake({ club: card });
    await api.updateClub('KBR000000001', { goals: false });
    expect(send).toHaveBeenCalledWith('PATCH', '/clubs/KBR000000001', { goals: false });
    await api.updateClub('KBR000000001', { name: ' New ', hidden: true });
    expect(send).toHaveBeenLastCalledWith('PATCH', '/clubs/KBR000000001', { name: 'New', hidden: true });
  });

  it('joins with the goals consent and a code only when given', async () => {
    const { send, api } = fake({ state: 'asked' });
    expect(await api.joinClub('KBR000000001')).toBe('asked');
    expect(send).toHaveBeenLastCalledWith('POST', '/clubs/KBR000000001/join', undefined);
    await api.joinClub('KBR000000001', { goalsConsent: true });
    expect(send).toHaveBeenLastCalledWith('POST', '/clubs/KBR000000001/join', { goalsConsent: true });
    await api.joinClub('KBR000000001', { goalsConsent: true, code: 'K7QM2XPA' });
    expect(send).toHaveBeenLastCalledWith('POST', '/clubs/KBR000000001/join', { goalsConsent: true, code: 'K7QM2XPA' });
  });

  it('accepts an invite with the consent; declines and cancels', async () => {
    const { send, api } = fake({ club: { ...card, myRole: 'member' } });
    await api.acceptClubInvite('KBR000000001', { goalsConsent: true });
    expect(send).toHaveBeenLastCalledWith('POST', '/clubs/KBR000000001/invite/accept', { goalsConsent: true });
    await api.declineClubInvite('KBR000000001');
    expect(send).toHaveBeenLastCalledWith('POST', '/clubs/KBR000000001/invite/decline');
    await api.cancelJoin('KBR000000001');
    expect(send).toHaveBeenLastCalledWith('DELETE', '/clubs/KBR000000001/join');
  });

  it('approves, declines, invites, sets roles, removes and leaves', async () => {
    const { send, api } = fake(null);
    await api.approveRequest('KBR000000001', 'P2');
    expect(send).toHaveBeenLastCalledWith('POST', '/clubs/KBR000000001/requests/P2/accept');
    await api.declineRequest('KBR000000001', 'P2');
    expect(send).toHaveBeenLastCalledWith('POST', '/clubs/KBR000000001/requests/P2/decline');
    await api.inviteBuddy('KBR000000001', 'P3');
    expect(send).toHaveBeenLastCalledWith('POST', '/clubs/KBR000000001/invites', { pid: 'P3' });
    await api.setRole('KBR000000001', 'P3', 'admin');
    expect(send).toHaveBeenLastCalledWith('PATCH', '/clubs/KBR000000001/members/P3', { role: 'admin' });
    await api.removeMember('KBR000000001', 'P3');
    expect(send).toHaveBeenLastCalledWith('DELETE', '/clubs/KBR000000001/members/P3');
    await api.leaveClub('KBR000000001');
    expect(send).toHaveBeenLastCalledWith('DELETE', '/clubs/KBR000000001/members/me');
    await api.deleteClub('KBR000000001');
    expect(send).toHaveBeenLastCalledWith('DELETE', '/clubs/KBR000000001');
  });

  it('escapes ids in the path', async () => {
    const { send, api } = fake(null);
    await api.removeMember('KBR000000001', 'a/b');
    expect(send).toHaveBeenLastCalledWith('DELETE', '/clubs/KBR000000001/members/a%2Fb');
  });

  it('turns the board on and reads it', async () => {
    const { send, api } = fake({ weekStart: '2026-11-23', rows: [{ walker: ravi, weekSteps: 41000 }] });
    await api.setBoard('KBR000000001', true);
    expect(send).toHaveBeenLastCalledWith('PUT', '/clubs/KBR000000001/board', { on: true });
    const b = await api.board('KBR000000001');
    expect(send).toHaveBeenLastCalledWith('GET', '/clubs/KBR000000001/board');
    expect(b.rows[0].weekSteps).toBe(41000);
  });

  it('reads requests and reports, closes a report', async () => {
    const r = fake({ requests: [{ walker: ravi, at: 1 }] });
    expect(await r.api.clubRequests('KBR000000001')).toHaveLength(1);
    expect(r.send).toHaveBeenLastCalledWith('GET', '/clubs/KBR000000001/requests');
    const rep = fake({ reports: [] });
    await rep.api.clubReports('KBR000000001');
    await rep.api.closeClubReport('KBR000000001', 'R1', 'removed');
    expect(rep.send).toHaveBeenLastCalledWith('POST', '/clubs/KBR000000001/reports/R1/close', { action: 'removed' });
  });

  it('makes a club code and finds a club by a code typed with spaces', async () => {
    const c = fake({ code: 'K7QM2XPA', codeExpiresAt: 1 });
    expect((await c.api.newClubCode('KBR000000001')).code).toBe('K7QM2XPA');
    expect(c.send).toHaveBeenLastCalledWith('POST', '/clubs/KBR000000001/code');
    const f = fake({ club: { ...card, myState: 'none' } });
    const found = await f.api.clubByCode('k7qm 2xpa');
    expect(f.send).toHaveBeenLastCalledWith('POST', '/clubs/code', { code: 'K7QM2XPA' });
    expect(found.clubId).toBe('KBR000000001');
    // A look-alike letter typed in is sent as the server reads it.
    await f.api.clubByCode('k7qm-2xpo');
    expect(f.send).toHaveBeenLastCalledWith('POST', '/clubs/code', { code: 'K7QM2XP0' });
    await expect(fake({}).api.clubByCode('K7QM2XPA')).rejects.toThrow();
  });

  it('sends steps and reads whether they were kept', async () => {
    const { send, api } = fake({ stored: true });
    const body = { day: '2026-11-24', steps: 5000, weekStart: '2026-11-23', weekSteps: 9000, tz: 'Asia/Kolkata' };
    expect(await api.putSteps(body)).toBe(true);
    expect(send).toHaveBeenLastCalledWith('PUT', '/me/steps', body);
    expect(await fake({ stored: false }).api.putSteps(body)).toBe(false);
  });
});
