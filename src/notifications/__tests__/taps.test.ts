import { describe, expect, it } from '@jest/globals';

import { buddiesRoute, journalRoute, tapHref, tapOf } from '../taps';

/** Every route the server's pushes send (stepsinfra push.route_data callers). */
const CLUB = 'KBR000000001';
const SERVER_ROUTES: [string, string][] = [
  ['/buddies/requests', '/buddies/requests'],
  ['/buddies', '/plus'],
  ['/buddies/family', '/plus'],
  ['/buddies/chat/b.P1ME00000000', '/buddies/chat/b.P1ME00000000'],
  ['/buddies/chat/b.0123456789abcdef01234567', '/buddies/chat/b.0123456789abcdef01234567'],
  [`/buddies/chat/c.${CLUB}`, `/buddies/chat/c.${CLUB}`],
  ['/buddies/chat/f.FAM000000001', '/buddies/chat/f.FAM000000001'],
  [`/buddies/club/${CLUB}`, `/buddies/club/${CLUB}`],
  [`/buddies/club/${CLUB}?seg=goals`, `/buddies/club/${CLUB}?seg=goals`],
  [`/buddies/club/${CLUB}/admin`, `/buddies/club/${CLUB}/admin`],
  ['/buddies/plan/PLN000000001', '/buddies/plan/PLN000000001'],
];

describe('notification taps', () => {
  it('follows every route the server sends', () => {
    for (const [to, path] of SERVER_ROUTES) expect(buddiesRoute({ open: 'buddies', to })).toBe(path);
  });

  it('ignores anything off the list', () => {
    for (const to of [
      '/settings',
      'https://example.com',
      '/buddies/club/KBR000000001?seg=delete',
      '/buddies/club/KBR000000001/../settings',
      '/buddies/chat/x.KBR000000001',
      '/buddies/chat/c.KBR',
      '/buddies/plan/PLN000000001?x=1',
      `/buddies/club/${'A'.repeat(200)}`,
    ])
      expect(buddiesRoute({ open: 'buddies', to })).toBeNull();
    expect(buddiesRoute({ open: 'water', to: '/buddies/requests' })).toBeNull();
    expect(buddiesRoute({ open: 'buddies' })).toBeNull();
    expect(buddiesRoute(null)).toBeNull();
  });

  it('opens a journal section or a buddies screen', () => {
    expect(tapOf({ open: 'food' })).toBe('food');
    expect(tapOf({ open: 'buddies', to: `/buddies/club/${CLUB}?seg=goals` })).toBe(`/buddies/club/${CLUB}?seg=goals`);
    expect(tapOf({ open: 'elsewhere' })).toBeNull();
    expect(tapHref('water')).toEqual(journalRoute('water'));
    expect(tapHref('/buddies/requests')).toBe('/buddies/requests');
  });
});
