/**
 * Calls to the Walk buddies routes (/v1/social, stepsinfra
 * docs/walk-buddies-server.md). One helper sends every request with the
 * sign-in token; answers are checked in read.ts. Views never import this:
 * hooks get it through BuddiesSource (source.tsx).
 */
import { getAccessToken } from '@/auth/session';
import { tokenError } from '@/api/food-read';
import { STEPS_API_URL } from '@/constants/app';
import { premiumRequired } from '@/premium/premium';

import { makeClubsApi } from './clubs-api';
import { readClubInvites } from './clubs-read';
import { makeGoalsApi } from './goals-api';
import { makePlansApi } from './plans-api';
import {
  readBuddies,
  readChats,
  readMe,
  readMessage,
  readNearby,
  readPage,
  readRequests,
  readWalker,
  SocialError,
  socialErrorFor,
} from './read';
import type { BuddyRow, ChatRow, Message, MessagePage, Nearby, NotifyPrefs, ReportReason, Requests, SocialMe, Walker } from './types';
import { TERMS_VERSION } from './types';

export interface SocialDeps {
  fetch: typeof fetch;
  token: () => Promise<string>;
  baseUrl: string;
}

const defaults: SocialDeps = { fetch: (...a) => fetch(...a), token: getAccessToken, baseUrl: STEPS_API_URL };

const TIMEOUT_MS = 15_000;

export async function call(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  deps: SocialDeps = defaults,
): Promise<unknown> {
  let token: string;
  try {
    token = await deps.token();
  } catch (e) {
    const t = tokenError('estimate', e);
    throw new SocialError(t.kind === 'offline' ? 'offline' : t.kind === 'other' ? 'other' : 'signin');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await deps.fetch(`${deps.baseUrl}/v1/social${path}`, {
        method,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw socialErrorFor(null);
    }
    if (res.status === 204) return null;
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const o = (json ?? {}) as { error?: unknown; why?: unknown };
      if (res.status === 402) premiumRequired();
      throw socialErrorFor(
        res.status,
        typeof o.error === 'string' ? o.error : undefined,
        typeof o.why === 'string' ? o.why : undefined,
      );
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

const enc = encodeURIComponent;

export const socialApi = {
  me: async (): Promise<SocialMe> => readMe(await call('GET', '/me')),
  join: async (handle: string, name: string): Promise<SocialMe> =>
    readMe(await call('POST', '/join', { adult: true, terms: TERMS_VERSION, handle, name })),
  /** `notify` alone needs no premium (a lapsed person can still turn reminders off). */
  updateMe: async (patch: { name?: string; handle?: string; notify?: Partial<NotifyPrefs> }): Promise<SocialMe> =>
    readMe(await call('PATCH', '/me', patch)),
  leave: async (): Promise<void> => {
    await call('DELETE', '/me');
  },

  findWalker: async (handle: string): Promise<Walker> => {
    const r = (await call('GET', `/walkers/${enc(handle)}`)) as { walker?: unknown } | null;
    return readWalker(r?.walker);
  },
  /** Show me in this 5 km area (a geohash-5 code). */
  setArea: async (area: string): Promise<void> => {
    await call('PUT', '/me/area', { area });
  },
  clearArea: async (): Promise<void> => {
    await call('DELETE', '/me/area');
  },
  nearby: async (): Promise<Nearby> => readNearby(await call('GET', '/nearby')),
  requests: async (): Promise<Requests> => {
    const r = await call('GET', '/requests');
    return { ...readRequests(r), clubInvites: readClubInvites(r) };
  },
  ask: async (pid: string): Promise<'requested' | 'buddies'> => {
    const r = (await call('POST', '/requests', { pid })) as { state?: unknown } | null;
    return r?.state === 'buddies' ? 'buddies' : 'requested';
  },
  accept: async (pid: string): Promise<void> => {
    await call('POST', `/requests/${enc(pid)}/accept`);
  },
  decline: async (pid: string): Promise<void> => {
    await call('POST', `/requests/${enc(pid)}/decline`);
  },
  cancel: async (pid: string): Promise<void> => {
    await call('DELETE', `/requests/${enc(pid)}`);
  },

  buddies: async (): Promise<BuddyRow[]> => readBuddies(await call('GET', '/buddies')),
  removeBuddy: async (pid: string): Promise<void> => {
    await call('DELETE', `/buddies/${enc(pid)}`);
  },

  chats: async (): Promise<ChatRow[]> => readChats(await call('GET', '/chats')),
  messages: async (key: string, page: { after?: string; before?: string } = {}): Promise<MessagePage> => {
    const q = page.after ? `?after=${enc(page.after)}` : page.before ? `?before=${enc(page.before)}` : '';
    return readPage(await call('GET', `/chats/${enc(key)}/messages${q}`));
  },
  send: async (key: string, text: string, clientId: string): Promise<Message> => {
    const r = (await call('POST', `/chats/${enc(key)}/messages`, { text, clientId })) as { message?: unknown } | null;
    return readMessage(r?.message);
  },
  read: async (key: string, upTo: string): Promise<void> => {
    await call('POST', `/chats/${enc(key)}/read`, { upTo });
  },
  deleteMessage: async (key: string, msgId: string): Promise<void> => {
    await call('DELETE', `/chats/${enc(key)}/messages/${enc(msgId)}`);
  },

  block: async (pid: string): Promise<void> => {
    await call('POST', '/blocks', { pid });
  },
  report: async (r: { kind: 'walker' | 'message' | 'club'; pid?: string; ref?: string; reason: ReportReason; note?: string }) => {
    await call('POST', '/reports', r);
  },

  // Clubs (clubs-api.ts).
  ...makeClubsApi((method, path, body) => call(method, path, body)),
  // Walk plans (plans-api.ts).
  ...makePlansApi((method, path, body) => call(method, path, body)),
  // Shared club goals (goals-api.ts).
  ...makeGoalsApi((method, path, body) => call(method, path, body)),
};

export type SocialApi = typeof socialApi;
