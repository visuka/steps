import { describe, expect, it } from '@jest/globals';

import { chatItems, cleanHandle, countLabel, handleProblem, mergeMessages, messageProblem, newClientId, newestId, nextDelay } from '../chat-logic';
import { badgeCount, displayName, readChats, readMe, readPage, readWalker, socialErrorFor } from '../read';
import type { Message } from '../types';

const msg = (id: string, at: number, mine = false, text = 'hi', pid = mine ? 'me' : 'p1'): Message => ({
  id,
  at,
  mine,
  text,
  from: { pid, handle: pid, name: null },
});

describe('walker ID', () => {
  it('cleans and checks like the server', () => {
    expect(cleanHandle(' @ravi_walks ')).toBe('ravi_walks');
    expect(handleProblem('ravi_walks')).toBeNull();
    expect(handleProblem('ab')).not.toBeNull();
    expect(handleProblem('a'.repeat(21))).not.toBeNull();
    expect(handleProblem('ravi walks')).not.toBeNull();
    expect(handleProblem('admin')).not.toBeNull();
    expect(handleProblem('Steps_1')).not.toBeNull();
    expect(handleProblem('stepsfan')).toBeNull();
  });
});

describe('message text', () => {
  it('refuses empty and long, counts from 450', () => {
    expect(messageProblem('  ')).toBe('empty');
    expect(messageProblem('x'.repeat(501))).not.toBeNull();
    expect(messageProblem('hello')).toBeNull();
    expect(countLabel('x'.repeat(449))).toBeNull();
    expect(countLabel('x'.repeat(480))).toBe('480/500');
  });
});

describe('polling', () => {
  it('slows down when quiet and on 429', () => {
    expect(nextDelay({ lastActivityAt: 0, throttled: false }, 30_000)).toBe(4_000);
    expect(nextDelay({ lastActivityAt: 0, throttled: false }, 61_000)).toBe(10_000);
    expect(nextDelay({ lastActivityAt: 0, throttled: false }, 301_000)).toBe(30_000);
    expect(nextDelay({ lastActivityAt: 0, throttled: true }, 1_000)).toBe(30_000);
  });
});

describe('merging', () => {
  it('dedupes pages and drops a pending send once the server has it', () => {
    const pending: Message = { ...msg('local-1', 1000, true, 'see you'), state: 'sending' };
    const merged = mergeMessages([msg('a', 500), msg('a', 500), msg('b', 1200, true, 'see you')], [pending]);
    expect(merged.map((m) => m.id)).toEqual(['a', 'b']);
  });
  it('keeps a failed send at its time', () => {
    const failed: Message = { ...msg('local-2', 900, true, 'later'), state: 'failed' };
    expect(mergeMessages([msg('a', 500), msg('b', 1200)], [failed]).map((m) => m.id)).toEqual(['a', 'local-2', 'b']);
  });
  it('newest id skips phone-only messages', () => {
    expect(newestId([msg('a', 1), { ...msg('l', 5), state: 'sending' }])).toBe('a');
    expect(newestId([])).toBeUndefined();
  });
  it('client ids are 24 safe characters', () => {
    expect(newClientId()).toMatch(/^[0-9a-z]{24}$/);
  });
});

describe('chat items', () => {
  it('adds day dividers and groups one sender', () => {
    const day = (at: number) => (at < 10_000_000 ? 'Fri' : 'Sat');
    const items = chatItems([msg('a', 0), msg('b', 60_000), msg('c', 120_000, true), msg('d', 20_000_000)], day);
    expect(items.map((i) => (i.type === 'day' ? i.label : i.key))).toEqual(['Fri', 'a', 'b', 'c', 'Sat', 'd']);
    const a = items[1];
    const b = items[2];
    expect(a.type === 'msg' && a.firstOfGroup && !a.lastOfGroup).toBe(true);
    expect(b.type === 'msg' && !b.firstOfGroup && b.lastOfGroup).toBe(true);
  });
});

describe('reading answers', () => {
  it('reads me and counts the badge', () => {
    expect(readMe({ joined: false })).toEqual({ joined: false });
    const me = readMe({ joined: true, pid: 'p', handle: 'h', name: '', counts: { requestsIn: 2, unread: 3 } });
    expect(me.joined && me.name).toBeNull();
    expect(badgeCount(me)).toBe(5);
    expect(badgeCount(null)).toBe(0);
  });
  it('rejects a walker without an id', () => {
    expect(() => readWalker({ handle: 'x' })).toThrow();
    expect(readWalker({ pid: 'p', handle: 'x', relation: 'weird' }).relation).toBe('none');
  });
  it('sorts chats newest first and reads pages', () => {
    const rows = readChats({ chats: [{ key: 'b.1', lastAt: 1 }, { key: 'b.2', lastAt: 5 }, 'junk'] });
    expect(rows.map((r) => r.key)).toEqual(['b.2', 'b.1']);
    expect(readPage({ messages: [{ id: 'm', text: 'hi', at: 1, mine: true }], more: false }).messages[0].mine).toBe(true);
  });
  it('maps errors to kinds', () => {
    expect(socialErrorFor(null).kind).toBe('offline');
    expect(socialErrorFor(422, 'text_not_allowed').kind).toBe('text');
    expect(socialErrorFor(409, 'not_joined').kind).toBe('not_joined');
    expect(socialErrorFor(429).kind).toBe('limit');
    expect(socialErrorFor(500).kind).toBe('other');
  });
  it('names a person', () => {
    expect(displayName({ name: ' Ravi ', handle: 'r' })).toBe('Ravi');
    expect(displayName({ name: null, handle: 'r' })).toBe('@r');
  });
});
