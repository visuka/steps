/**
 * Walk buddies hooks. The API comes from BuddiesSource, so the design preview
 * can swap in sample data without the network; views never call the API
 * themselves. The last /me answer is kept on the phone for the badge and a
 * first paint offline.
 */
import { useFocusEffect } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useApp } from '@/state/app-state';

import { socialApi, type SocialApi } from './api';
import { mergeMessages, messageProblem, newClientId, newestId, nextDelay } from './chat-logic';
import { SocialError } from './read';
import type { Message, SocialMe } from './types';

const Source = createContext<SocialApi>(socialApi);

export function BuddiesSource({ api, children }: { api: SocialApi; children: ReactNode }) {
  return <Source.Provider value={api}>{children}</Source.Provider>;
}

export const useSocialApi = () => useContext(Source);

export const ME_KEY = 'buddies.me';

/** Every kv key Walk buddies writes; wiped on sign-out and reset. */
export const BUDDIES_KV_KEYS = [ME_KEY] as const;

function messageOf(e: unknown): string {
  return e instanceof SocialError ? e.message : 'Something went wrong. Try again.';
}

/** /me: joined or not, and the badge counts. Refreshes when the screen is focused. */
export function useSocialMe() {
  const api = useSocialApi();
  const { repo } = useApp();
  const [me, setMeState] = useState<SocialMe | null>(null);
  const [error, setError] = useState<SocialError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    repo.getKv<SocialMe>(ME_KEY).then((saved) => {
      if (live && saved) setMeState((cur) => cur ?? saved);
    });
    return () => {
      live = false;
    };
  }, [repo]);

  const setMe = useCallback(
    (next: SocialMe) => {
      setMeState(next);
      void repo.setKv(ME_KEY, next);
    },
    [repo],
  );

  const refresh = useCallback(async () => {
    try {
      const next = await api.me();
      setMe(next);
      setError(null);
    } catch (e) {
      setError(e instanceof SocialError ? e : new SocialError('other'));
    } finally {
      setLoading(false);
    }
  }, [api, setMe]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { me, setMe, error, loading, refresh };
}

/** Load something on focus, with refresh and a plain error line. */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const refresh = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { data, error, loading, refresh, setData };
}

/** Run an action; returns an error message or null. */
export async function attempt(action: () => Promise<unknown>): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (e) {
    return messageOf(e);
  }
}

/**
 * One open chat: the messages, sending with retry, and polling while the app
 * is in front (4 s, slowing to 10 s and 30 s when quiet; docs 3.2).
 */
export function useChat(key: string) {
  const api = useSocialApi();
  const [server, setServer] = useState<Message[]>([]);
  const [local, setLocal] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const serverRef = useRef<Message[]>([]);
  const poll = useRef({ lastActivityAt: 0, throttled: false });
  const lastRead = useRef<string | undefined>(undefined);

  const take = useCallback((incoming: Message[]) => {
    if (!incoming.length) return false;
    const known = new Set(serverRef.current.map((m) => m.id));
    const fresh = incoming.filter((m) => !known.has(m.id));
    if (!fresh.length) return false;
    serverRef.current = [...serverRef.current, ...fresh];
    setServer(serverRef.current);
    return true;
  }, []);

  const markRead = useCallback(() => {
    const upTo = newestId(serverRef.current);
    if (upTo && upTo !== lastRead.current) {
      lastRead.current = upTo;
      api.read(key, upTo).catch(() => {
        lastRead.current = undefined;
      });
    }
  }, [api, key]);

  const fetchNew = useCallback(async () => {
    try {
      const after = newestId(serverRef.current);
      const page = await api.messages(key, after ? { after } : {});
      if (take(page.messages)) poll.current.lastActivityAt = Date.now();
      poll.current.throttled = false;
      setError(null);
      setLoaded(true);
      markRead();
    } catch (e) {
      if (e instanceof SocialError && e.kind === 'limit') poll.current.throttled = true;
      if (e instanceof SocialError && (e.kind === 'forbidden' || e.kind === 'not_found')) setClosed(true);
      else setError(messageOf(e));
      setLoaded(true);
    }
  }, [api, key, take, markRead]);

  // Poll while focused and the app is in front.
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let stopped = false;
      let active = AppState.currentState === 'active';
      poll.current.lastActivityAt = Date.now();
      const loop = async () => {
        if (stopped) return;
        if (active) await fetchNew();
        if (stopped) return;
        timer = setTimeout(loop, nextDelay(poll.current, Date.now()));
      };
      void loop();
      const sub = AppState.addEventListener('change', (s) => {
        const was = active;
        active = s === 'active';
        if (active && !was) {
          if (timer) clearTimeout(timer);
          poll.current.lastActivityAt = Date.now();
          void loop();
        }
      });
      return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        sub.remove();
      };
    }, [fetchNew]),
  );

  const deliver = useCallback(
    async (pending: Message) => {
      setLocal((l) => [...l.filter((m) => m.id !== pending.id), { ...pending, state: 'sending' }]);
      try {
        const sent = await api.send(key, pending.text, pending.clientId ?? pending.id);
        take([sent]);
        setLocal((l) => l.filter((m) => m.id !== pending.id));
        poll.current.lastActivityAt = Date.now();
        return null;
      } catch (e) {
        setLocal((l) => l.map((m) => (m.id === pending.id ? { ...m, state: 'failed' } : m)));
        return messageOf(e);
      }
    },
    [api, key, take],
  );

  /** Send text; returns an error message for the snackbar, or null. */
  const send = useCallback(
    async (text: string): Promise<string | null> => {
      const t = text.trim();
      const problem = messageProblem(t);
      if (problem) return problem === 'empty' ? null : problem;
      const clientId = newClientId();
      const pending: Message = {
        id: `local-${clientId}`,
        clientId,
        mine: true,
        from: { pid: 'me', handle: '', name: null },
        text: t,
        at: Date.now(),
        state: 'sending',
      };
      return deliver(pending);
    },
    [deliver],
  );

  const retry = useCallback((m: Message) => deliver(m), [deliver]);

  const remove = useCallback(
    async (m: Message): Promise<string | null> => {
      if (m.state) {
        setLocal((l) => l.filter((x) => x.id !== m.id));
        return null;
      }
      const err = await attempt(() => api.deleteMessage(key, m.id));
      if (!err) {
        serverRef.current = serverRef.current.filter((x) => x.id !== m.id);
        setServer(serverRef.current);
      }
      return err;
    },
    [api, key],
  );

  return { messages: mergeMessages(server, local), loaded, error, closed, send, retry, remove };
}
