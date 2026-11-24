import { describe, expect, it, jest } from '@jest/globals';

import { makeClubsApi, type Send } from '../clubs-api';
import { clubErrorText } from '../clubs';
import { readClubCard, readClubPage, readElection, readLastElection } from '../clubs-read';
import {
  actingWords,
  bannerButton,
  bannerWords,
  candidateLine,
  candidateOrder,
  canInClub,
  canPlanClubWalk,
  canPlanForCard,
  cardElectionWords,
  endsWords,
  HOW_IT_WORKS,
  lastElectionWords,
  leaveAsk,
  myPidOf,
  powerRole,
  standNote,
  voteDoneWords,
  voteWord,
} from '../election';
import { planErrorText } from '../plans';
import { socialErrorFor } from '../read';
import type { ClubElection, ClubMember, ElectionCandidate } from '../types';

const style = { uses24h: false, locale: 'en-GB' } as const;
// Mon 23 Nov 2026, 10:00 local.
const NOW = new Date(2026, 10, 23, 10, 0).getTime();
const DAY = 86_400_000;

const ravi = { pid: 'P1RAVI000000', handle: 'ravi_walks', name: 'Ravi', relation: 'buddy' as const };
const me = { pid: 'P1ME00000000', handle: 'you_walk', name: 'Kavya', relation: 'self' as const };
const arjun = { pid: 'P1ARJUN00000', handle: 'arjun22', name: null, relation: 'none' as const };
const members: ClubMember[] = [
  { walker: ravi, role: 'admin' },
  { walker: me, role: 'member' },
  { walker: arjun, role: 'member' },
];
const card = { clubId: 'GSW000000006', name: 'Gachibowli Stadium Walkers', area: 'Gachibowli', memberCount: 26, myState: 'member', goals: false, captain: null };

const cand = (w: { pid: string; handle: string; name: string | null }, isMe = false): ElectionCandidate => ({ pid: w.pid, handle: w.handle, name: w.name, isMe });
const open: ClubElection = {
  endsAt: new Date(2026, 10, 26, 18, 0).getTime(),
  actingPid: ravi.pid,
  candidates: [cand(ravi), cand(me, true)],
  myVote: ravi.pid,
  iStand: true,
  canVote: true,
};

describe('reading the vote', () => {
  const raw = {
    endsAt: open.endsAt,
    actingPid: ravi.pid,
    candidates: [
      { pid: ravi.pid, handle: 'ravi_walks', name: 'Ravi', isMe: false },
      { pid: me.pid, handle: 'you_walk', isMe: true },
      { pid: ravi.pid, handle: 'ravi_walks' },
      { handle: 'no_pid' },
      'junk',
    ],
    myVote: ravi.pid,
    iStand: true,
    canVote: true,
  };

  it('reads an open vote, leaving out broken and repeated candidates', () => {
    const e = readElection(raw)!;
    expect(e.endsAt).toBe(open.endsAt);
    expect(e.actingPid).toBe(ravi.pid);
    expect(e.candidates).toEqual([cand(ravi), { pid: me.pid, handle: 'you_walk', name: null, isMe: true }]);
    expect(e.myVote).toBe(ravi.pid);
    expect(e.iStand).toBe(true);
    expect(e.canVote).toBe(true);
  });

  it('drops a vote for someone not standing, and anything for someone who cannot vote', () => {
    expect(readElection({ ...raw, myVote: 'P1GONE000000' })!.myVote).toBeNull();
    const late = readElection({ ...raw, canVote: false })!;
    expect(late.myVote).toBeNull();
    expect(late.iStand).toBe(false);
  });

  it('is null without an end time or an object', () => {
    expect(readElection(null)).toBeNull();
    expect(readElection({ ...raw, endsAt: 0 })).toBeNull();
    expect(readElection({ candidates: [] })).toBeNull();
  });

  it('reads the last result, with an unknown "how" as votes', () => {
    expect(readLastElection({ winnerPid: ravi.pid, handle: 'ravi_walks', decidedAt: NOW, how: 'tie_earliest' })).toEqual({
      winnerPid: ravi.pid,
      handle: 'ravi_walks',
      decidedAt: NOW,
      how: 'tie_earliest',
    });
    expect(readLastElection({ winnerPid: ravi.pid, handle: 'ravi_walks', decidedAt: NOW, how: 'landslide' })!.how).toBe('votes');
    expect(readLastElection({ winnerPid: ravi.pid, decidedAt: NOW })).toBeNull();
    expect(readLastElection(undefined)).toBeNull();
  });

  it('reads the vote next to "club" or inside it, for members only', () => {
    const page = readClubPage({ club: { ...card, myRole: 'member' }, members: [], election: raw });
    expect(page.election?.endsAt).toBe(open.endsAt);
    expect(page.club.electionOpen).toBe(true);
    expect(page.lastElection).toBeNull();
    expect(readClubPage({ club: { ...card, myRole: 'member', election: raw } }).election?.actingPid).toBe(ravi.pid);
    const outside = readClubPage({ club: { ...card, myState: 'none' }, election: raw, lastElection: { winnerPid: ravi.pid, handle: 'r', decidedAt: NOW } });
    expect(outside.election).toBeNull();
    expect(outside.lastElection).toBeNull();
    const decided = readClubPage({ club: { ...card, myRole: 'member' }, lastElection: { winnerPid: ravi.pid, handle: 'ravi_walks', decidedAt: NOW, how: 'votes' } });
    expect(decided.election).toBeNull();
    expect(decided.lastElection?.handle).toBe('ravi_walks');
  });

  it('reads electionOpen on a member card only', () => {
    expect(readClubCard({ ...card, electionOpen: true }).electionOpen).toBe(true);
    expect(readClubCard({ ...card, electionOpen: 'yes' }).electionOpen).toBeUndefined();
    expect(readClubCard({ ...card, myState: 'none', electionOpen: true }).electionOpen).toBeUndefined();
  });
});

describe('election calls', () => {
  it('stands, withdraws, votes and clears the vote', async () => {
    const send = jest.fn<Send>(async () => ({ ok: true }));
    const api = makeClubsApi(send);
    await api.standForCaptain('GSW000000006', true);
    await api.standForCaptain('GSW000000006', false);
    await api.voteForCaptain('GSW000000006', ravi.pid);
    await api.clearCaptainVote('GSW000000006');
    expect(send.mock.calls).toEqual([
      ['POST', '/clubs/GSW000000006/election/stand', { stand: true }],
      ['POST', '/clubs/GSW000000006/election/stand', { stand: false }],
      ['PUT', '/clubs/GSW000000006/election/vote', { pid: ravi.pid }],
      ['DELETE', '/clubs/GSW000000006/election/vote'],
    ]);
  });

  it('says the vote errors in plain words', () => {
    expect(clubErrorText(socialErrorFor(409, 'conflict', 'not_open'))).toBe('Voting for a captain has ended.');
    expect(clubErrorText(socialErrorFor(403, 'forbidden', 'not_eligible'))).toMatch(/members when voting started/);
    expect(clubErrorText(socialErrorFor(400, 'bad_request', 'not_candidate'))).toBe("They're not standing any more.");
    expect(clubErrorText(socialErrorFor(409, 'conflict', 'election_open'))).toMatch(/choosing a new captain/);
  });
});

describe('who may do what while members vote', () => {
  it('finds my pid from the member list', () => {
    expect(myPidOf(members)).toBe(me.pid);
    expect(myPidOf([])).toBeNull();
  });

  it('gives the acting captain a vice-captain’s powers, only during a vote', () => {
    const acting = { actingPid: me.pid };
    expect(powerRole('member', acting, me.pid)).toBe('admin');
    expect(powerRole('member', acting, arjun.pid)).toBe('member');
    expect(powerRole('member', null, me.pid)).toBe('member');
    expect(powerRole('admin', { actingPid: null }, me.pid)).toBe('admin');
    expect(powerRole(null, acting, me.pid)).toBeNull();
  });

  it('lets no one delete the club or change roles while the vote is open', () => {
    const vote = { actingPid: me.pid };
    expect(canInClub('member', 'approve', vote, me.pid)).toBe(true);
    expect(canInClub('member', 'removeMember', vote, me.pid)).toBe(true);
    expect(canInClub('member', 'setRole', vote, me.pid)).toBe(false);
    expect(canInClub('admin', 'delete', vote, me.pid)).toBe(false);
    expect(canInClub('owner', 'delete', null, me.pid)).toBe(true);
    expect(canInClub('owner', 'setRole', null, me.pid)).toBe(true);
    expect(canInClub('member', 'approve', vote, arjun.pid)).toBe(false);
  });

  it('lets only the captain, vice-captains and the acting captain plan club walks', () => {
    expect(canPlanClubWalk('owner', null, me.pid)).toBe(true);
    expect(canPlanClubWalk('admin', null, me.pid)).toBe(true);
    expect(canPlanClubWalk('member', null, me.pid)).toBe(false);
    expect(canPlanClubWalk('member', { actingPid: me.pid }, me.pid)).toBe(true);
    expect(canPlanClubWalk(null, null, null)).toBe(false);
    expect(canPlanForCard({ myState: 'member', myRole: 'admin', captain: null })).toBe(true);
    expect(canPlanForCard({ myState: 'member', myRole: 'member', captain: null })).toBe(false);
    expect(canPlanForCard({ myState: 'member', captain: me })).toBe(true);
    expect(canPlanForCard({ myState: 'asked', myRole: 'owner', captain: me })).toBe(false);
  });

  it('says a staff-only plan error plainly', () => {
    expect(planErrorText(socialErrorFor(403, 'forbidden', 'staff_only'))).toBe('The captain and vice-captains plan club walks.');
    expect(planErrorText(socialErrorFor(403, 'forbidden'))).toBe("You can't change this walk.");
  });
});

describe('election words', () => {
  it('says when it ends: today, tomorrow, or the weekday', () => {
    expect(endsWords(new Date(2026, 10, 23, 18, 0).getTime(), NOW, style)).toBe('today 6:00 pm');
    expect(endsWords(new Date(2026, 10, 24, 6, 30).getTime(), NOW, style)).toBe('tomorrow 6:30 am');
    expect(endsWords(open.endsAt, NOW, style)).toBe('Thu 6:00 pm');
    expect(endsWords(open.endsAt, NOW, { uses24h: true, locale: 'en-GB' })).toBe('Thu 18:00');
  });

  it('writes the banner and its button', () => {
    expect(bannerWords(open, NOW, style)).toBe('Choosing a new captain · ends Thu 6:00 pm');
    expect(bannerButton({ canVote: true, myVote: null })).toBe('Vote');
    expect(bannerButton({ canVote: true, myVote: ravi.pid })).toBe('Change vote');
    expect(bannerButton({ canVote: false, myVote: null })).toBe('See who is standing');
  });

  it('has three short how-it-works lines, with no "won" or "lost"', () => {
    expect(HOW_IT_WORKS).toHaveLength(3);
    for (const line of HOW_IT_WORKS) {
      expect(line.length).toBeLessThan(90);
      expect(line).not.toMatch(/\b(won|win|wins|lost|lose|loser|winner)\b/i);
    }
  });

  it('names the acting captain', () => {
    expect(actingWords(open, members, me.pid)).toBe('@ravi_walks is the acting captain until voting ends.');
    expect(actingWords({ ...open, actingPid: me.pid }, members, me.pid)).toBe("You're the acting captain until voting ends.");
    expect(actingWords({ ...open, actingPid: 'P1GONE000000' }, members, me.pid)).toBeNull();
    expect(actingWords({ ...open, actingPid: null }, members, me.pid)).toBeNull();
  });

  it('labels each candidate’s button', () => {
    expect(voteWord(ravi.pid, null)).toBe('Vote');
    expect(voteWord(ravi.pid, ravi.pid)).toBe('Your vote');
    expect(voteWord(me.pid, ravi.pid)).toBe('Change');
  });

  it('orders candidates by name, and marks me', () => {
    const list = candidateOrder([cand(ravi), cand(arjun), cand(me, true)]);
    expect(list.map((c) => c.handle)).toEqual(['arjun22', 'you_walk', 'ravi_walks']);
    expect(candidateLine(cand(me, true))).toBe('You · @you_walk');
    expect(candidateLine(cand(ravi))).toBe('@ravi_walks');
  });

  it('notes the stand switch', () => {
    expect(standNote({ canVote: true, iStand: true })).toMatch(/withdraw/);
    expect(standNote({ canVote: true, iStand: false })).toMatch(/vote for you/);
    expect(standNote({ canVote: false, iStand: false })).toMatch(/members when voting started/);
  });

  it('shows the result for 7 days, in neutral words', () => {
    const last = { winnerPid: ravi.pid, handle: 'ravi_walks', decidedAt: NOW - 2 * DAY, how: 'votes' as const };
    expect(lastElectionWords(last, NOW, me.pid)).toBe('@ravi_walks is the new captain.');
    expect(lastElectionWords({ ...last, winnerPid: me.pid }, NOW, me.pid)).toBe("You're the new captain.");
    expect(lastElectionWords({ ...last, decidedAt: NOW - 8 * DAY }, NOW, me.pid)).toBeNull();
    expect(lastElectionWords(null, NOW, me.pid)).toBeNull();
  });

  it('marks a club row while members vote', () => {
    expect(cardElectionWords({ myState: 'member', electionOpen: true })).toBe('Voting for captain');
    expect(cardElectionWords({ myState: 'member' })).toBeNull();
    expect(cardElectionWords({ myState: 'asked', electionOpen: true })).toBeNull();
  });

  it('asks the right Leave question', () => {
    expect(leaveAsk('owner', 1, 'KBR').message).toBe("You're the only member. Leaving deletes the club.");
    expect(leaveAsk('owner', 48, 'KBR')).toEqual({
      title: 'Leave KBR?',
      message: "Members will vote for a new captain over the next 2 days. You can't undo this.",
      confirm: 'Leave',
    });
    expect(leaveAsk('member', 48, 'KBR').message).toMatch(/club chat and the board/);
  });

  it('confirms a vote without saying anything to others', () => {
    expect(voteDoneWords(ravi.pid, open.candidates)).toBe('You voted for Ravi. Your vote is secret.');
    expect(voteDoneWords(me.pid, open.candidates)).toBe('You voted for yourself. Your vote is secret.');
    expect(voteDoneWords(null, open.candidates)).toBe('Your vote is cleared.');
  });
});
