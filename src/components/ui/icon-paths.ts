/**
 * The Clean+ icons, shape for shape as docs/design/spec.md section 8 lists them
 * (the mockup's `<svg class="i">` content, plus the lock from section 10.3).
 * 24-unit viewBox, no fill, stroke 1.5, round caps and joins, shown at 20 dp.
 * Pure data, so jest can check it.
 */

/** A path, or a circle [cx, cy, r]. */
export type IconPart = string | readonly [number, number, number];

export const ICON_PARTS = {
  bowl: ['M4 12h16a8 8 0 0 1-16 0z', 'M9 8c0-1.2 1-1.5 1-2.7M13 8c0-1.2 1-1.5 1-2.7'],
  'chevron-right': ['M9 6l6 6-6 6'],
  'chevron-left': ['M15 6l-6 6 6 6'],
  'chevron-down': ['M7 10l5 5 5-5'],
  drop: ['M12 3.5c3 3.6 6 7 6 10.5a6 6 0 0 1-12 0c0-3.5 3-6.9 6-10.5z'],
  plus: ['M12 6v12M6 12h12'],
  moon: ['M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z'],
  walker: [[13, 4.5, 1.5], 'M9.5 21l2.5-6.5 2.5 2.5V21', 'M12 14.5l1.2-5.5 2.8 2.5 2.5.5', 'M13.2 9l-3.2 1.5-1.5 3'],
  today: [[12, 12, 8], 'M12 4a8 8 0 0 1 8 8', 'M12 8.5v3.5l2.5 1.5'],
  pulse: ['M3 12h4l2.5-6 5 12 2.5-6h4'],
  person: [[12, 8.5, 3.5], 'M5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5'],
  fish: [
    'M5 12c2.4-3.3 5.6-5 9-5 2.8 0 5 2 6 5-1 3-3.2 5-6 5-3.4 0-6.6-1.7-9-5z',
    'M5 12L2.5 9M5 12l-2.5 3',
    'M16.5 11v.1',
  ],
  egg: ['M12 3.5c3.2 0 6 5 6 9.5a6 6 0 0 1-12 0c0-4.5 2.8-9.5 6-9.5z'],
  onion: ['M12 3.5c0 3-6.5 5-6.5 10a6.5 6.5 0 0 0 13 0c0-5-6.5-7-6.5-10z', 'M12 10.5c-1.5 2-2 4-2 6M12 10.5c1.5 2 2 4 2 6'],
  tomato: [[12, 13.5, 6.5], 'M9 6.5l3 1.5 3-1.5M12 8V4.5'],
  bottle: ['M10 3.5h4M10.5 3.5V7L8 10.5V19a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 16 19v-8.5L13.5 7V3.5', 'M8 14h8'],
  warning: ['M12 4l8.5 15.5h-17z', 'M12 10v4M12 16.8v.1'],
  sun: [
    [12, 12, 3.5],
    'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4',
  ],
  clock: [[12, 12, 8], 'M12 8v4l2.5 1.5'],
  feet: [
    'M8 4c1.4 0 2.2 1.6 2.2 3.6S9.4 10.5 8 10.5 6 9.5 6 7.6 6.6 4 8 4z',
    'M6.5 13h3v1.5a1.5 1.5 0 0 1-3 0z',
    'M16 8.5c1.4 0 2 1.6 2 3.6s-.6 2.9-2 2.9-2.2-1-2.2-2.9.8-3.6 2.2-3.6z',
    'M14.5 17.5h3v1a1.5 1.5 0 0 1-3 0z',
  ],
  gauge: ['M4.5 16.5a8 8 0 1 1 15 0', 'M12 13.5l3.5-4', [12, 13.5, 1]],
  stairs: ['M4 19h4v-4h4v-4h4V7h4'],
  car: ['M4 16.5v-4l2.2-5h11.6l2.2 5v4z', 'M4 12.5h16', 'M7 16.5v2M17 16.5v2'],
  // Section 10.3: the premium-locked tile.
  lock: ['M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5'],
} as const satisfies Record<string, readonly IconPart[]>;

export type SpecIconName = keyof typeof ICON_PARTS;

/** The lock's body is a rounded rectangle (section 10.3): x 5, y 10.5, 14 × 9.5, rx 2. */
export const LOCK_BODY = { x: 5, y: 10.5, width: 14, height: 9.5, rx: 2 } as const;
