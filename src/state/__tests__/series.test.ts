import { describe, expect, it } from '@jest/globals';

import {
  activeMinutesMissing,
  activePoints,
  bucketBy15Min,
  bucketByHour,
  clockAt,
  dayEndMs,
  dayStartMs,
  formatMinutes,
  hasMinuteData,
  ianaZone,
  isDayKey,
  logsInRange,
  needsMoreLogs,
  parseKind,
  quarterClock,
  quartersOfHour,
  type SeriesPoint,
  seriesLabel,
  shiftDay,
  stepPoints,
  sum,
  wallHour,
} from '../series';

const MIN = 60_000;
const HOUR = 3_600_000;
const INDIA = 330;
const PARIS = 60;
const DAY = '2026-11-14';

/** A few points spread over the day, in the given zone. */
function sample(tz: number): SeriesPoint[] {
  const start = dayStartMs(DAY, tz);
  return [
    { at: start, value: 10 }, // 00:00 -> hour 0
    { at: start + 7 * HOUR + 5 * MIN, value: 200 },
    { at: start + 7 * HOUR + 50 * MIN, value: 300 },
    { at: start + 12 * HOUR, value: 40 },
    { at: start + 24 * HOUR - 1, value: 5 }, // 23:59:59.999 -> hour 23
  ];
}

describe('bucketByHour', () => {
  it.each([
    ['India +5:30', INDIA],
    ['a whole-hour zone', PARIS],
    ['a zone west of UTC', -300],
  ])('hour buckets sum to the day total in %s', (_n, tz) => {
    const points = sample(tz);
    const hours = bucketByHour(points, DAY, tz);
    expect(hours).toHaveLength(24);
    expect(sum(hours)).toBe(sum(points.map((p) => p.value)));
    expect(hours[0]).toBe(10);
    expect(hours[7]).toBe(500);
    expect(hours[12]).toBe(40);
    expect(hours[23]).toBe(5);
  });

  it('23:59 lands in hour 23 and 00:00 the next day is not in this day', () => {
    const start = dayStartMs(DAY, INDIA);
    const points = [
      { at: start + 23 * HOUR + 59 * MIN, value: 7 },
      { at: start + 24 * HOUR, value: 99 }, // 00:00 next day
      { at: start - 1, value: 55 }, // 23:59:59.999 the day before
    ];
    const hours = bucketByHour(points, DAY, INDIA);
    expect(hours[23]).toBe(7);
    expect(sum(hours)).toBe(7);
    // The next day's own buckets take it at hour 0.
    expect(bucketByHour(points, '2026-11-15', INDIA)[0]).toBe(99);
  });

  it('puts an instant in the right local hour: 19:00 UTC is 00:30 the next day in India', () => {
    // 2026-11-14 19:00 UTC = 2026-11-15 00:30 IST
    const at = Date.UTC(2026, 10, 14, 19, 0);
    expect(bucketByHour([{ at, value: 1 }], '2026-11-15', INDIA)[0]).toBe(1);
    expect(sum(bucketByHour([{ at, value: 1 }], DAY, INDIA))).toBe(0);
    // 18:29 UTC is still 23:59 on the 14th in India.
    const before = Date.UTC(2026, 10, 14, 18, 29);
    expect(bucketByHour([{ at: before, value: 1 }], DAY, INDIA)[23]).toBe(1);
  });

  it('puts an instant in the right local hour in a whole-hour zone', () => {
    // 22:30 UTC on the 13th is 23:30 the 13th in Paris winter time; 23:00 UTC is 00:00 on the 14th.
    const at = Date.UTC(2026, 10, 13, 23, 0);
    expect(bucketByHour([{ at, value: 3 }], DAY, PARIS)[0]).toBe(3);
    expect(sum(bucketByHour([{ at: Date.UTC(2026, 10, 13, 22, 59), value: 3 }], DAY, PARIS))).toBe(0);
  });

  it('an empty day gives 24 zeros', () => {
    expect(bucketByHour([], DAY, INDIA)).toEqual(new Array(24).fill(0));
  });

  it('ignores points that are not numbers', () => {
    const start = dayStartMs(DAY, INDIA);
    const hours = bucketByHour([{ at: NaN, value: 4 }, { at: start, value: Infinity }, { at: start, value: 2 }], DAY, INDIA);
    expect(sum(hours)).toBe(2);
  });
});

describe('bucketBy15Min', () => {
  it('has 96 slots and the 15-minute buckets sum to their hour', () => {
    for (const tz of [INDIA, PARIS]) {
      const points = sample(tz);
      const quarters = bucketBy15Min(points, DAY, tz);
      const hours = bucketByHour(points, DAY, tz);
      expect(quarters).toHaveLength(96);
      for (let h = 0; h < 24; h++) expect(sum(quartersOfHour(quarters, h))).toBe(hours[h]);
      expect(sum(quarters)).toBe(sum(hours));
    }
  });

  it('edges: :14:59 is the first quarter, :15:00 the second', () => {
    const start = dayStartMs(DAY, INDIA) + 7 * HOUR;
    const q = quartersOfHour(
      bucketBy15Min(
        [
          { at: start + 14 * MIN + 59_000, value: 1 },
          { at: start + 15 * MIN, value: 2 },
          { at: start + 59 * MIN, value: 4 },
        ],
        DAY,
        INDIA,
      ),
      7,
    );
    expect(q).toEqual([1, 2, 0, 4]);
  });

  it('an empty day gives 96 zeros', () => {
    expect(bucketBy15Min([], DAY, INDIA)).toEqual(new Array(96).fill(0));
  });
});

describe('step and active points', () => {
  it('a bucket counts in the hour it starts in', () => {
    const start = dayStartMs(DAY, INDIA) + 8 * HOUR + 50 * MIN;
    const hours = bucketByHour(stepPoints([{ start, end: start + 15 * MIN, steps: 120 }, { start, end: start + MIN, steps: 0 }]), DAY, INDIA);
    expect(hours[8]).toBe(120);
    expect(sum(hours)).toBe(120);
  });

  it('active minutes count minutes at 100 steps a minute or more', () => {
    const t = dayStartMs(DAY, INDIA) + 6 * HOUR;
    const buckets = [
      { start: t, end: t + MIN, steps: 110 }, // active
      { start: t + MIN, end: t + 2 * MIN, steps: 99 }, // not
      { start: t + 2 * MIN, end: t + 3 * MIN, steps: 150 }, // active
      { start: t + 10 * MIN, end: t + 20 * MIN, steps: 1000 }, // 100 a minute for 10 minutes
    ];
    const hours = bucketByHour(activePoints(buckets, 100), DAY, INDIA);
    expect(hours[6]).toBe(12);
    expect(sum(hours)).toBe(12);
  });
});

describe('days and text', () => {
  it('validates day keys', () => {
    expect(isDayKey('2026-11-14')).toBe(true);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('14-11-2026')).toBe(false);
    expect(isDayKey(undefined)).toBe(false);
  });

  it('reads the kind, and walk is not one', () => {
    expect(parseKind('steps')).toBe('steps');
    expect(parseKind(['sleep'])).toBe('sleep');
    expect(parseKind('walk')).toBeNull();
    expect(parseKind(undefined)).toBeNull();
  });

  it('never goes to a future day', () => {
    expect(shiftDay('2026-11-13', 1, '2026-11-14')).toBe('2026-11-14');
    expect(shiftDay('2026-11-14', 1, '2026-11-14')).toBeNull();
    expect(shiftDay('2026-11-14', -1, '2026-11-14')).toBe('2026-11-13');
    expect(shiftDay('2026-12-01', -1, '2026-12-01')).toBe('2026-11-30');
  });

  it('minute data only within the synced days', () => {
    expect(hasMinuteData(0, 7)).toBe(true);
    expect(hasMinuteData(6, 7)).toBe(true);
    expect(hasMinuteData(7, 7)).toBe(false);
  });

  it('formats clocks and durations', () => {
    expect(quarterClock(0, 0)).toBe('12:00 am');
    expect(quarterClock(7, 2)).toBe('7:30 am');
    expect(quarterClock(23, 3)).toBe('11:45 pm');
    expect(clockAt(Date.UTC(2026, 10, 14, 19, 0), INDIA)).toBe('12:30 am');
    expect(formatMinutes(95)).toBe('1 h 35 min');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 h');
  });

  it('speaks the total as the sum of the bars', () => {
    const hours = new Array<number>(24).fill(0);
    hours[7] = 1500;
    hours[8] = 500;
    expect(seriesLabel('Steps', 'steps', hours)).toBe('Steps by hour: 2,000 steps in total, busiest hour 7 to 8 am with 1,500');
    expect(seriesLabel('Water', 'ml', hours.map(() => 0))).toBe('Water by hour: none');
  });
});

describe('daylight saving (explicit transitions)', () => {
  const paris = ianaZone('Europe/Paris');
  const ny = ianaZone('America/New_York');

  it('reads offsets from the zone', () => {
    expect(paris(Date.UTC(2026, 2, 29, 0, 59))).toBe(60);
    expect(paris(Date.UTC(2026, 2, 29, 1, 0))).toBe(120);
    expect(paris(Date.UTC(2026, 9, 25, 0, 59))).toBe(120);
    expect(paris(Date.UTC(2026, 9, 25, 1, 0))).toBe(60);
    expect(ny(Date.UTC(2026, 2, 8, 6, 59))).toBe(-300);
    expect(ny(Date.UTC(2026, 2, 8, 7, 0))).toBe(-240);
  });

  it('spring forward in Paris: the day is 23 hours, 10:00 lands in hour 10, the skipped hour is 0', () => {
    const day = '2026-03-29';
    const start = dayStartMs(day, paris);
    expect(start).toBe(Date.UTC(2026, 2, 28, 23, 0));
    expect(dayEndMs(day, paris) - start).toBe(23 * HOUR);
    const ten = Date.UTC(2026, 2, 29, 8, 0); // 10:00 CEST
    const hours = bucketByHour(
      [
        { at: start, value: 1 }, // 00:00
        { at: Date.UTC(2026, 2, 29, 0, 59), value: 2 }, // 01:59 CET
        { at: Date.UTC(2026, 2, 29, 1, 0), value: 4 }, // 03:00 CEST
        { at: ten, value: 8 },
        { at: dayEndMs(day, paris) - 1, value: 16 }, // 23:59:59.999
      ],
      day,
      paris,
    );
    expect(hours[0]).toBe(1);
    expect(hours[1]).toBe(2);
    expect(hours[2]).toBe(0);
    expect(hours[3]).toBe(4);
    expect(hours[10]).toBe(8);
    expect(hours[23]).toBe(16);
    expect(sum(hours)).toBe(31);
    expect(wallHour(ten, paris)).toBe(10);
    expect(clockAt(ten, paris)).toBe('10:00 am');
  });

  it('fall back in Paris: the day is 25 hours and the repeated hour adds to its wall hour', () => {
    const day = '2026-10-25';
    const start = dayStartMs(day, paris);
    expect(start).toBe(Date.UTC(2026, 9, 24, 22, 0));
    expect(dayEndMs(day, paris) - start).toBe(25 * HOUR);
    const first = Date.UTC(2026, 9, 24, 23, 30); // 01:30 CEST
    const second = Date.UTC(2026, 9, 25, 0, 30); // 02:30 CEST
    const repeat = Date.UTC(2026, 9, 25, 1, 30); // 02:30 CET, same wall hour
    const ten = Date.UTC(2026, 9, 25, 9, 0); // 10:00 CET
    const points = [
      { at: first, value: 1 },
      { at: second, value: 2 },
      { at: repeat, value: 4 },
      { at: ten, value: 8 },
      { at: dayEndMs(day, paris) - 1, value: 16 },
    ];
    const hours = bucketByHour(points, day, paris);
    expect(hours[1]).toBe(1);
    expect(hours[2]).toBe(6);
    expect(hours[10]).toBe(8);
    expect(hours[23]).toBe(16);
    expect(sum(hours)).toBe(31);
    const quarters = bucketBy15Min(points, day, paris);
    for (let h = 0; h < 24; h++) expect(sum(quartersOfHour(quarters, h))).toBe(hours[h]);
    // The neighbouring days do not take any of it.
    expect(sum(bucketByHour(points, '2026-10-24', paris))).toBe(0);
    expect(sum(bucketByHour(points, '2026-10-26', paris))).toBe(0);
  });

  it('New York spring forward and fall back', () => {
    const spring = '2026-03-08';
    const s0 = dayStartMs(spring, ny);
    expect(s0).toBe(Date.UTC(2026, 2, 8, 5, 0));
    expect(dayEndMs(spring, ny) - s0).toBe(23 * HOUR);
    const h = bucketByHour([{ at: Date.UTC(2026, 2, 8, 15, 0), value: 5 }], spring, ny); // 11:00 EDT
    expect(h[11]).toBe(5);
    const fall = '2026-11-01';
    expect(dayEndMs(fall, ny) - dayStartMs(fall, ny)).toBe(25 * HOUR);
    const f = bucketByHour(
      [
        { at: Date.UTC(2026, 10, 1, 5, 30), value: 1 }, // 01:30 EDT
        { at: Date.UTC(2026, 10, 1, 6, 30), value: 2 }, // 01:30 EST
        { at: Date.UTC(2026, 10, 1, 15, 0), value: 4 }, // 10:00 EST
      ],
      fall,
      ny,
    );
    expect(f[1]).toBe(3);
    expect(f[10]).toBe(4);
  });

  it('a zone function equals the fixed offset away from transitions', () => {
    const pts = sample(60);
    expect(bucketByHour(pts, DAY, paris)).toEqual(bucketByHour(pts, DAY, PARIS));
  });
});

describe('water range and active minutes', () => {
  const logs = [
    { id: 'a', loggedAt: 5000 },
    { id: 'b', loggedAt: 3000 },
    { id: 'c', loggedAt: 1000 },
  ];

  it('keeps only logs inside the day', () => {
    expect(logsInRange(logs, 1000, 5000).map((l) => l.id)).toEqual(['b', 'c']);
    expect(logsInRange(logs, 6000, 7000)).toEqual([]);
  });

  it('asks for a bigger read only when the read is full and has not reached the day', () => {
    expect(needsMoreLogs(logs, 3, 500)).toBe(true); // full, oldest 1000 is still inside: older ones may exist
    expect(needsMoreLogs(logs, 3, 2000)).toBe(false); // reached older than the day's start
    expect(needsMoreLogs(logs, 10, 500)).toBe(false); // not full: that is all of them
    expect(needsMoreLogs([], 400, 0)).toBe(false);
  });

  it('active minutes are missing without buckets, or all zero while the stored total is above 0', () => {
    const b = [{ start: 0, end: MIN, steps: 50 }];
    const zeros = new Array<number>(24).fill(0);
    expect(activeMinutesMissing(null, zeros, 30)).toBe(true);
    expect(activeMinutesMissing([], zeros, 0)).toBe(true);
    expect(activeMinutesMissing(b, zeros, 30)).toBe(true);
    expect(activeMinutesMissing(b, zeros, 0)).toBe(false);
    expect(activeMinutesMissing(b, zeros, null)).toBe(false);
    expect(activeMinutesMissing(b, [0, 12, ...zeros.slice(2)], 30)).toBe(false);
  });
});
