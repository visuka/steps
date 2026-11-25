import { describe, expect, it, jest } from '@jest/globals';

import {
  boardRows,
  can,
  canPlanClubWalk,
  canPlanForCard,
  canRemove,
  cardLeaveAsk,
  cardRole,
  clubErrorText,
  clubLine,
  clubProblem,
  heirOf,
  isConsentError,
  joinOrAccept,
  leaveAsk,
  needsConsent,
  ROLE_WORD,
  roleChange,
  searchReady,
  sortMembers,
  standWordOf,
  stateWord,
} from '../clubs';
import { SocialError, socialErrorFor } from '../read';
import { planErrorText } from '../plans';
import type { ClubMember, Walker } from '../types';

const w = (pid: string, handle: string, name: string | null = null, relation: Walker['relation'] = 'none'): Walker => ({ pid, handle, name, relation });
const m = (walker: Walker, role: ClubMember['role']): ClubMember => ({ walker, role });

describe('roles', () => {
  it("uses the owner's words", () => {
    expect(ROLE_WORD).toEqual({ owner: 'Captain', admin: 'Vice-captain', member: 'Member' });
  });

  it('lets the captain and vice-captains run the club, only the captain set roles and delete', () => {
    expect(can('owner', 'delete')).toBe(true);
    expect(can('admin', 'delete')).toBe(false);
    expect(can('admin', 'approve')).toBe(true);
    expect(can('member', 'approve')).toBe(false);
    expect(can('owner', 'setRole')).toBe(true);
    expect(can('admin', 'setRole')).toBe(false);
    expect(can('member', 'leave')).toBe(true);
    expect(can(null, 'leave')).toBe(false);
  });

  it("shows my role on a home club row: the server's, else Captain when the captain is me", () => {
    const base = { myState: 'member' as const, captain: w('1', 'ravi', 'Ravi', 'buddy') };
    expect(cardRole({ ...base, myRole: 'admin' })).toBe('admin');
    expect(standWordOf({ ...base, myRole: 'admin' })).toBe('Vice-captain');
    expect(standWordOf({ ...base, myRole: 'member' })).toBe('Member');
    expect(standWordOf({ ...base, captain: w('9', 'me', 'Me', 'self') })).toBe('Captain');
    expect(cardRole(base)).toBeNull();
    expect(standWordOf(base)).toBe('');
    expect(standWordOf({ ...base, myState: 'asked', myRole: 'owner' })).toBe('Asked');
    expect(standWordOf({ ...base, myState: 'invited' })).toBe('Invited');
    expect(cardRole({ ...base, myState: 'none', myRole: 'owner' })).toBeNull();
  });

  it('sorts captain, vice-captains, then members by name', () => {
    const list = sortMembers([m(w('3', 'zed'), 'member'), m(w('2', 'bob'), 'admin'), m(w('1', 'amy'), 'member'), m(w('0', 'cap'), 'owner')]);
    expect(list.map((x) => x.walker.handle)).toEqual(['cap', 'bob', 'amy', 'zed']);
  });

  it('offers Make vice-captain only while there are fewer than 2', () => {
    const cap = m(w('0', 'cap'), 'owner');
    const a = m(w('1', 'a'), 'member');
    const v1 = m(w('2', 'v1'), 'admin');
    const v2 = m(w('3', 'v2'), 'admin');
    expect(roleChange(a, [cap, a, v1])).toEqual({ to: 'admin', label: 'Make vice-captain' });
    expect(roleChange(a, [cap, a, v1, v2])).toBeNull();
    expect(roleChange(v1, [cap, a, v1, v2])).toEqual({ to: 'member', label: 'Make member' });
    expect(roleChange(cap, [cap])).toBeNull();
  });

  it('never removes the captain or me; vice-captains only by the captain', () => {
    const cap = m(w('0', 'cap'), 'owner');
    const vice = m(w('2', 'v'), 'admin');
    const mem = m(w('3', 'x'), 'member');
    const me = m(w('9', 'me', null, 'self'), 'member');
    expect(canRemove('owner', vice, '0')).toBe(true);
    expect(canRemove('admin', vice, '2b')).toBe(false);
    expect(canRemove('admin', mem, '2')).toBe(true);
    expect(canRemove('admin', cap, '2')).toBe(false);
    expect(canRemove('member', mem, '9')).toBe(false);
    expect(canRemove('owner', me, null)).toBe(false);
    expect(canRemove('owner', mem, '3')).toBe(false);
  });
});

describe('the board', () => {
  it('ranks high first, equal steps share a rank', () => {
    const rows = boardRows([
      { walker: w('1', 'a'), weekSteps: 100 },
      { walker: w('2', 'b'), weekSteps: 900 },
      { walker: w('3', 'c'), weekSteps: 100 },
      { walker: w('4', 'd'), weekSteps: 50 },
    ]);
    expect(rows.map((r) => [r.walker.handle, r.rank])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 2],
      ['d', 4],
    ]);
  });
});

describe('words and checks', () => {
  it('writes the club line', () => {
    expect(clubLine({ area: 'Banjara Hills', memberCount: 48 })).toBe('Banjara Hills · 48 members');
    expect(clubLine({ area: '', memberCount: 1 })).toBe('1 member');
    expect(clubLine({ area: ' ', memberCount: 1200 })).toBe('1,200 members');
  });

  it('says where I stand', () => {
    expect(stateWord({ myState: 'none' })).toBe('Ask to join');
    expect(stateWord({ myState: 'asked' })).toBe('Asked');
    expect(stateWord({ myState: 'invited' })).toBe('Invited');
    expect(stateWord({ myState: 'member' })).toBe('Member');
  });

  it('checks the form like the server', () => {
    expect(clubProblem({ name: 'KB', area: '', about: '' })).not.toBeNull();
    expect(clubProblem({ name: '  K  B  ', area: '', about: '' })).toBeNull();
    expect(clubProblem({ name: 'x'.repeat(41), area: '', about: '' })).not.toBeNull();
    expect(clubProblem({ name: 'KBR', area: 'x'.repeat(41), about: '' })).not.toBeNull();
    expect(clubProblem({ name: 'KBR', area: '', about: 'x'.repeat(201) })).not.toBeNull();
    expect(clubProblem({ name: 'KBR Morning Walkers', area: 'Banjara Hills', about: 'Every morning' })).toBeNull();
  });

  it('searches from 2 to 40 characters', () => {
    expect(searchReady(' k ')).toBe(false);
    expect(searchReady('kb')).toBe(true);
    expect(searchReady('x'.repeat(41))).toBe(false);
  });

  it('asks for the goals consent only for clubs with goals', () => {
    expect(needsConsent({ goals: true })).toBe(true);
    expect(needsConsent({ goals: false })).toBe(false);
  });

  it("knows the server's goals consent answer (goals were turned on after the phone looked)", () => {
    expect(isConsentError(new SocialError('conflict', 'conflict', 'goals_consent'))).toBe(true);
    expect(isConsentError(new SocialError('conflict', 'conflict', 'club_full'))).toBe(false);
    expect(isConsentError(new Error('goals_consent'))).toBe(false);
  });

  it('puts club errors in plain words', () => {
    expect(clubErrorText(new SocialError('conflict', 'conflict', 'club_full'))).toMatch(/full/);
    expect(clubErrorText(new SocialError('conflict', 'conflict', 'goals_consent'))).toMatch(/shared goals/);
    expect(clubErrorText(new SocialError('limit', 'join_limit'))).toMatch(/5 clubs/);
    expect(clubErrorText(new SocialError('not_found', 'not_found', 'bad_code'))).toMatch(/code/);
    expect(clubErrorText(new SocialError('offline'))).toMatch(/offline/);
    expect(clubErrorText(new Error('x'))).toMatch(/went wrong/);
  });
});

describe('joining', () => {
  const calls = () => ({
    joinClub: jest.fn(async (_id: string, _o?: { goalsConsent?: boolean; code?: string }) => 'asked' as const),
    acceptClubInvite: jest.fn(async (_id: string, _o?: { goalsConsent?: boolean; code?: string }) => null),
  });

  it('sends nothing for a club with goals until the person agrees', async () => {
    const api = calls();
    expect(await joinOrAccept(api, { clubId: 'K', myState: 'none', goals: true })).toBe('needs_consent');
    expect(api.joinClub).not.toHaveBeenCalled();
    expect(await joinOrAccept(api, { clubId: 'K', myState: 'none', goals: true }, { consent: true })).toBe('asked');
    expect(api.joinClub).toHaveBeenCalledWith('K', { goalsConsent: true });
  });

  it('asks without a consent field when the club has no goals, with a code when given', async () => {
    const api = calls();
    await joinOrAccept(api, { clubId: 'K', myState: 'none', goals: false });
    expect(api.joinClub).toHaveBeenLastCalledWith('K', {});
    await joinOrAccept(api, { clubId: 'K', myState: 'none', goals: false }, { code: 'K7QM2XPA' });
    expect(api.joinClub).toHaveBeenLastCalledWith('K', { code: 'K7QM2XPA' });
  });

  it('accepts an invite instead of asking', async () => {
    const api = calls();
    expect(await joinOrAccept(api, { clubId: 'K', myState: 'invited', goals: true }, { consent: true })).toBe('member');
    expect(api.acceptClubInvite).toHaveBeenCalledWith('K', { goalsConsent: true });
    expect(api.joinClub).not.toHaveBeenCalled();
  });
});

describe('club walks', () => {
  it('lets only the captain and vice-captains plan club walks', () => {
    expect(canPlanClubWalk('owner')).toBe(true);
    expect(canPlanClubWalk('admin')).toBe(true);
    expect(canPlanClubWalk('member')).toBe(false);
    expect(canPlanClubWalk(null)).toBe(false);
    const cap = w('9', 'me', 'Me', 'self');
    expect(canPlanForCard({ myState: 'member', myRole: 'admin', captain: null })).toBe(true);
    expect(canPlanForCard({ myState: 'member', myRole: 'member', captain: null })).toBe(false);
    expect(canPlanForCard({ myState: 'member', captain: cap })).toBe(true);
    expect(canPlanForCard({ myState: 'asked', myRole: 'owner', captain: cap })).toBe(false);
  });

  it('says a staff-only plan error plainly', () => {
    expect(planErrorText(socialErrorFor(403, 'forbidden', 'staff_only'))).toBe('The captain and vice-captains plan club walks.');
    expect(clubErrorText(socialErrorFor(403, 'forbidden', 'staff_only'))).toBe('The captain and vice-captains plan club walks.');
    expect(planErrorText(socialErrorFor(403, 'forbidden'))).toBe("You can't change this walk.");
  });
});

describe('when the captain leaves', () => {
  const me = w('0', 'cap', 'Kavya', 'self');
  const j = (walker: Walker, role: ClubMember['role'], joinedAt?: number): ClubMember => ({ walker, role, ...(joinedAt ? { joinedAt } : {}) });
  const ravi = w('1', 'ravi_walks', 'Ravi', 'buddy');
  const asha = w('2', 'asha_runs');
  const zed = w('3', 'zed');

  it('passes the club to the vice-captain who joined first', () => {
    const list = [j(me, 'owner', 1), j(zed, 'member', 2), j(asha, 'admin', 9), j(ravi, 'admin', 5)];
    expect(heirOf(list)?.walker.pid).toBe('1');
  });

  it('with no vice-captain, to the member who joined first', () => {
    expect(heirOf([j(me, 'owner', 1), j(zed, 'member', 7), j(asha, 'member', 3)])?.walker.pid).toBe('2');
  });

  it("can't tell without join times or anyone else", () => {
    expect(heirOf([j(me, 'owner', 1), j(ravi, 'admin', 5), j(zed, 'member')])).toBeNull();
    expect(heirOf([j(me, 'owner', 1)])).toBeNull();
    expect(heirOf([])).toBeNull();
  });

  it('asks the right Leave question', () => {
    const list = [j(me, 'owner', 1), j(asha, 'admin', 4), j(ravi, 'admin', 6)];
    expect(leaveAsk('owner', 3, 'KBR', list)).toEqual({
      title: 'Leave KBR?',
      message: "@asha_runs becomes captain. You leave the club chat and the board. If the club has shared goals, your goal history here is deleted. You can't undo this.",
      confirm: 'Leave',
    });
    expect(leaveAsk('owner', 2, 'KBR', [j(me, 'owner', 1), j(ravi, 'member', 2)]).message).toMatch(/^Ravi becomes captain\./);
    // Someone left out of the list (blocked, or not shown): the heir may be them, so the rule.
    expect(leaveAsk('owner', 4, 'KBR', list).message).toMatch(/^A vice-captain becomes captain, or/);
    // Members not loaded: the rule in plain words.
    expect(leaveAsk('owner', 48, 'KBR').message).toBe(
      "A vice-captain becomes captain, or the member who joined first if there is none. You leave the club chat and the board. If the club has shared goals, your goal history here is deleted. You can't undo this.",
    );
    expect(leaveAsk('owner', 1, 'KBR')).toEqual({ title: 'Leave KBR?', message: "You're the only member, so the club is deleted. You can't undo this.", confirm: 'Leave and delete' });
    expect(leaveAsk('member', 48, 'KBR')).toEqual({
      title: 'Leave KBR?',
      message: 'You leave the club chat and the board. If the club has shared goals, your goal history here is deleted.',
      confirm: 'Leave',
    });
    expect(leaveAsk('admin', 1, 'KBR').confirm).toBe('Leave');
  });

  it('asks the same from a club card (Your clubs without Premium)', () => {
    const card = { myState: 'member' as const, name: 'KBR', memberCount: 48, captain: null };
    expect(cardLeaveAsk({ ...card, myRole: 'owner' }).message).toMatch(/^A vice-captain becomes captain/);
    expect(cardLeaveAsk({ ...card, captain: me }).message).toMatch(/^A vice-captain becomes captain/);
    expect(cardLeaveAsk({ ...card, myRole: 'owner', memberCount: 1 }).confirm).toBe('Leave and delete');
    expect(cardLeaveAsk({ ...card, myRole: 'member' }).message).toMatch(/^You leave the club chat/);
  });
});
