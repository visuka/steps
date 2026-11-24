import { describe, expect, it } from '@jest/globals';

import {
  readBoard,
  readClub,
  readClubCard,
  readClubCode,
  readClubInvites,
  readClubPage,
  readClubReply,
  readClubReports,
  readClubRequests,
  readClubs,
  readJoinState,
} from '../clubs-read';
import { socialErrorFor } from '../read';

const ravi = { pid: 'P1RAVI000000', handle: 'ravi_walks', name: 'Ravi', relation: 'buddy' };
const card = {
  clubId: 'KBR000000001',
  name: 'KBR Morning Walkers',
  area: 'Banjara Hills',
  memberCount: 48,
  myState: 'member',
  goals: true,
  captain: ravi,
};

describe('club cards', () => {
  it('reads a good card, with goals and the captain', () => {
    const c = readClubCard(card);
    expect(c).toEqual({ ...card, captain: ravi });
  });

  it('falls back on odd fields: state none, no goals, no captain', () => {
    const c = readClubCard({ clubId: 'KBR000000001', name: 'KBR', myState: 'boss', goals: 'yes', captain: { pid: 1 }, memberCount: -3 });
    expect(c.myState).toBe('none');
    expect(c.goals).toBe(false);
    expect(c.captain).toBeNull();
    expect(c.memberCount).toBe(0);
    expect(c.area).toBe('');
  });

  it("reads my role on a card only for a member and a known role (GET /clubs/mine)", () => {
    expect(readClubCard({ ...card, myRole: 'admin' }).myRole).toBe('admin');
    expect(readClubCard({ ...card, myRole: 'boss' })).not.toHaveProperty('myRole');
    expect(readClubCard({ ...card, myState: 'asked', myRole: 'owner' })).not.toHaveProperty('myRole');
    expect(readClubCard(card)).not.toHaveProperty('myRole');
    expect(readClubs({ clubs: [{ ...card, myRole: 'owner' }] })[0].myRole).toBe('owner');
  });

  it('refuses a card without an id or a name, or a bad id', () => {
    expect(() => readClubCard({ name: 'KBR' })).toThrow();
    expect(() => readClubCard({ clubId: 'KBR000000001' })).toThrow();
    expect(() => readClubCard({ clubId: '../me', name: 'x' })).toThrow();
    expect(() => readClubCard(null)).toThrow();
    expect(() => readClubCard([card])).toThrow();
  });

  it('reads a list and leaves out broken rows', () => {
    const list = readClubs({ clubs: [card, { name: 'no id' }, 'x'] });
    expect(list.map((c) => c.clubId)).toEqual(['KBR000000001']);
    expect(() => readClubs({})).toThrow();
    expect(() => readClubs(null)).toThrow();
  });
});

describe('a club', () => {
  it('reads my role and board only when I am a member', () => {
    const c = readClub({ ...card, about: 'Every morning at 6', hidden: false, myRole: 'admin', myBoard: true });
    expect(c.myRole).toBe('admin');
    expect(c.myBoard).toBe(true);
    expect(c.about).toBe('Every morning at 6');
    const outside = readClub({ ...card, myState: 'none', myRole: 'owner', myBoard: true });
    expect(outside.myRole).toBeNull();
    expect(outside.myBoard).toBe(false);
  });

  it('refuses an unknown role', () => {
    expect(readClub({ ...card, myRole: 'king' }).myRole).toBeNull();
  });

  it('reads the page with members only for members, dropping broken rows', () => {
    const page = readClubPage({
      club: { ...card, myRole: 'member' },
      members: [{ walker: ravi, role: 'owner' }, { walker: { handle: 'x' }, role: 'member' }, { walker: ravi, role: 'boss' }],
    });
    expect(page.members).toEqual([{ walker: ravi, role: 'owner' }]);
    const outside = readClubPage({ club: { ...card, myState: 'asked' }, members: [{ walker: ravi, role: 'owner' }] });
    expect(outside.members).toEqual([]);
    expect(() => readClubPage({})).toThrow();
  });

  it('reads a {"club"} reply', () => {
    expect(readClubReply({ club: { ...card, myRole: 'owner' } }).myRole).toBe('owner');
    expect(() => readClubReply({ club: null })).toThrow();
  });
});

describe('requests, invites, board, reports, code', () => {
  it('reads join requests', () => {
    expect(readClubRequests({ requests: [{ walker: ravi, at: 5 }, { walker: null }] })).toEqual([{ walker: ravi, at: 5 }]);
    expect(() => readClubRequests({})).toThrow();
  });

  it('reads club invites as invited, and none when missing', () => {
    const rows = readClubInvites({ clubInvites: [{ club: { ...card, myState: 'none' }, by: ravi, at: 9 }, { club: {}, by: ravi }] });
    expect(rows).toHaveLength(1);
    expect(rows[0].club.myState).toBe('invited');
    expect(rows[0].by.handle).toBe('ravi_walks');
    expect(readClubInvites({ incoming: [] })).toEqual([]);
    expect(readClubInvites(null)).toEqual([]);
  });

  it('reads the board high first', () => {
    const b = readBoard({
      weekStart: '2026-11-23',
      rows: [
        { walker: ravi, weekSteps: 100 },
        { walker: { ...ravi, pid: 'P2', handle: 'meena' }, weekSteps: 900 },
        { walker: {}, weekSteps: 5 },
      ],
    });
    expect(b.weekStart).toBe('2026-11-23');
    expect(b.rows.map((r) => r.weekSteps)).toEqual([900, 100]);
    expect(readBoard({ weekStart: 'monday', rows: [] }).weekStart).toBe('');
    expect(() => readBoard({ weekStart: '2026-11-23' })).toThrow();
  });

  it('reads reports with the snapshot text, oldest first', () => {
    const r = readClubReports({
      reports: [
        { reportId: 'R2', kind: 'message', reason: 'spam', snapshot: { text: 'buy now' }, at: 20 },
        { reportId: 'R1', kind: 'walker', reason: 'hate', snapshot: { handle: 'bad_one' }, at: 10 },
        { kind: 'walker' },
      ],
    });
    expect(r.map((x) => x.reportId)).toEqual(['R1', 'R2']);
    expect(r[0].text).toBe('@bad_one');
    expect(r[1].text).toBe('buy now');
    expect(() => readClubReports({})).toThrow();
  });

  it('reads a club code of 8 Crockford characters only', () => {
    expect(readClubCode({ code: 'K7QM2XPA', codeExpiresAt: 5 })).toEqual({ code: 'K7QM2XPA', codeExpiresAt: 5 });
    expect(() => readClubCode({ code: 'K7QM2XPU' })).toThrow();
    expect(() => readClubCode({ code: 'short' })).toThrow();
  });

  it('reads the join state', () => {
    expect(readJoinState({ state: 'asked' })).toBe('asked');
    expect(readJoinState({ state: 'member' })).toBe('member');
    expect(readJoinState(null)).toBe('asked');
  });
});

describe('club errors', () => {
  it('keeps the why of a conflict', () => {
    const e = socialErrorFor(409, 'conflict', 'goals_consent');
    expect(e.kind).toBe('conflict');
    expect(e.why).toBe('goals_consent');
    expect(socialErrorFor(404, 'not_found', 'bad_code').why).toBe('bad_code');
    expect(socialErrorFor(429, 'join_limit').kind).toBe('limit');
  });
});
