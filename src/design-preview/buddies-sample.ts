/** Sample Walk buddies data for the design preview: no network. */
import type { SocialApi } from '@/buddies/api';
import type { ChatRow, Message, Walker } from '@/buddies/types';

const NOW = Date.now();
const MIN = 60_000;

const ravi: Walker = { pid: 'p1', handle: 'ravi_walks', name: 'Ravi', relation: 'buddy' };
const meera: Walker = { pid: 'p2', handle: 'meera.k', name: 'Meera', relation: 'buddy' };
const asha: Walker = { pid: 'p3', handle: 'asha_runs', name: 'Asha', relation: 'asked_me' };

const CHATS: ChatRow[] = [
  { key: 'b.p1', kind: 'buddy', title: 'Ravi', lastAt: NOW - 8 * MIN, lastText: 'Park at 6:30 tomorrow?', lastMine: false, unread: 2 },
  { key: 'b.p2', kind: 'buddy', title: 'Meera', lastAt: NOW - 26 * 60 * MIN, lastText: '9,800 today, close!', lastMine: true, unread: 0 },
];

const msg = (id: string, mine: boolean, text: string, ago: number): Message => ({
  id,
  mine,
  from: mine ? { pid: 'me', handle: 'you', name: 'You' } : { pid: 'p1', handle: 'ravi_walks', name: 'Ravi' },
  text,
  at: NOW - ago * MIN,
});

const MESSAGES: Message[] = [
  msg('m1', false, 'Morning walk done?', 40),
  msg('m2', true, 'Yes, 6,200 before work.', 35),
  msg('m3', false, 'Nice. Park at 6:30 tomorrow?', 8),
];

const ok = async () => undefined;

export const SAMPLE_SOCIAL_API: SocialApi = {
  me: async () => ({
    joined: true,
    pid: 'me',
    handle: 'you_walk',
    name: 'You',
    handleChangeFrom: 0,
    nearby: false,
    counts: { requestsIn: 1, unread: 2, clubInvites: 0, clubRequests: 0 },
  }),
  join: async () => SAMPLE_SOCIAL_API.me(),
  updateMe: async () => SAMPLE_SOCIAL_API.me(),
  leave: ok,
  findWalker: async () => ravi,
  requests: async () => ({ incoming: [{ walker: asha, at: NOW - 90 * MIN }], outgoing: [] }),
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
  messages: async () => ({ messages: MESSAGES, more: false }),
  send: async (_key, text, clientId) => ({ ...msg(clientId, true, text, 0), clientId }),
  read: ok,
  deleteMessage: ok,
  block: ok,
  report: ok,
};
