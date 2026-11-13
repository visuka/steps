import { describe, expect, it, jest } from '@jest/globals';

import type { SleepEntry } from '@/data/types';
import { checkNight, MAX_NIGHT_MS, nightClash, nightOf } from '@/lib/sleep';
import {
  atClock,
  BACK_DAYS,
  capAt,
  earliestAt,
  formatClock,
  formatDay,
  formatWhen,
  formatWhenInSentence,
  onDay,
  type OpenPicker,
  pickDateThenTime,
} from '@/lib/when';

const now = new Date(2026, 10, 13, 15, 0).getTime();
const at = (d: number, h: number, m = 0, month = 10, year = 2026) => new Date(year, month, d, h, m).getTime();
const twelve = { uses24h: false, locale: 'en-GB' };
const twentyFour = { uses24h: true, locale: 'en-GB' };
const HOUR = 3_600_000;

describe('entry times', () => {
  it('shows today and yesterday by name, with the time', () => {
    expect(formatWhen(at(13, 14, 35), now, twelve)).toBe('Today, 2:35 pm');
    expect(formatWhen(at(12, 9, 10), now, twelve)).toBe('Yesterday, 9:10 am');
  });

  it('shows older days with weekday, day and month', () => {
    expect(formatWhen(at(10, 20, 0), now, twelve)).toBe('Tue 10 Nov, 8:00 pm');
  });

  it('writes today and yesterday in lower case inside a sentence', () => {
    expect(formatWhenInSentence(at(13, 13), now, twelve)).toBe('today, 1:00 pm');
    expect(formatWhenInSentence(at(12, 13), now, twelve)).toBe('yesterday, 1:00 pm');
    expect(formatWhenInSentence(at(10, 20), now, twelve)).toBe('Tue 10 Nov, 8:00 pm');
  });

  it('adds the year for another year', () => {
    const text = formatDay(at(30, 8, 0, 11, 2025), now, twelve);
    expect(text).toContain('30 Dec');
    expect(text).toContain('2025');
    expect(formatDay(at(10, 8), now, twelve)).not.toContain('2026');
  });

  it('follows the region for the order of day and month', () => {
    const us = formatDay(at(10, 20), now, { uses24h: false, locale: 'en-US' });
    expect(us).toContain('Tue');
    expect(us).toContain('Nov 10');
  });

  it('follows the phone’s 12/24-hour setting', () => {
    expect(formatClock(at(13, 14, 35), twelve)).toBe('2:35 pm');
    expect(formatClock(at(13, 0, 5), twelve)).toBe('12:05 am');
    expect(formatClock(at(13, 12, 0), twelve)).toBe('12:00 pm');
    expect(formatClock(at(13, 14, 35), twentyFour)).toBe('14:35');
    expect(formatClock(at(13, 0, 5), twentyFour)).toBe('00:05');
    expect(formatWhen(at(12, 21, 40), now, twentyFour)).toBe('Yesterday, 21:40');
  });

  it('lets the locale decide when the setting isn’t known, and survives a bad locale', () => {
    expect(formatClock(at(13, 14, 35), { uses24h: null, locale: 'en-US' })).toMatch(/2:35/);
    expect(formatClock(at(13, 14, 35), { uses24h: null, locale: 'not a locale!' })).toBe('2:35 pm');
    expect(formatDay(at(10, 20), now, { uses24h: false, locale: 'not a locale!' })).toBe('Tue 10 Nov');
  });

  it('never goes past now', () => {
    expect(capAt(now + HOUR, now)).toBe(now);
    expect(capAt(at(14, 9), now)).toBe(now);
    expect(capAt(now - HOUR, now)).toBe(now - HOUR);
  });

  it('goes back a year at most, to the start of that day', () => {
    const earliest = earliestAt(now);
    expect(new Date(earliest).getHours()).toBe(0);
    expect(Math.floor((now - earliest) / (24 * HOUR))).toBe(BACK_DAYS);
    expect(capAt(at(1, 9, 0, 0, 2024), now)).toBe(earliest);
    expect(capAt(earliest + HOUR, now)).toBe(earliest + HOUR);
  });

  it('keeps the time of day when the date is picked, and the date when the time is', () => {
    const current = at(13, 14, 35);
    expect(onDay(current, new Date(2026, 10, 9))).toBe(at(9, 14, 35));
    expect(atClock(current, new Date(1999, 0, 1, 7, 5, 42))).toBe(at(13, 7, 5));
    // Today at a later hour than now: capped by the caller.
    expect(capAt(atClock(current, new Date(2026, 10, 13, 22, 0)), now)).toBe(now);
  });
});

describe('the date, then the time', () => {
  /** The phone's dialogs, answered in turn: a date or time, or null for Cancel (no value comes back). */
  function dialogs(answers: (Date | null)[]) {
    const shown: Parameters<OpenPicker>[0][] = [];
    const open: OpenPicker = (options) => {
      shown.push(options);
      const answer = answers.shift();
      if (answer) options.onValueChange({}, answer);
    };
    return { open, shown };
  }

  it('sets the picked day at the picked time, once', () => {
    const done = jest.fn();
    const { open, shown } = dialogs([new Date(2026, 10, 12), new Date(2000, 0, 1, 20, 15)]);
    pickDateThenTime(open, at(13, 13), now, done);
    expect(shown.map((s) => s.mode)).toEqual(['date', 'time']);
    expect(shown[0].minimumDate).toEqual(new Date(earliestAt(now)));
    expect(shown[0].maximumDate).toEqual(new Date(now));
    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(at(12, 20, 15));
  });

  it('changes nothing when the time is cancelled after a date was picked', () => {
    const done = jest.fn();
    const { open, shown } = dialogs([new Date(2026, 10, 12), null]);
    pickDateThenTime(open, at(13, 13), now, done);
    expect(shown.map((s) => s.mode)).toEqual(['date', 'time']);
    expect(done).not.toHaveBeenCalled();
  });

  it('changes nothing when the date is cancelled', () => {
    const done = jest.fn();
    const { open, shown } = dialogs([null]);
    pickDateThenTime(open, at(13, 13), now, done);
    expect(shown).toHaveLength(1);
    expect(done).not.toHaveBeenCalled();
  });
});

describe('sleep times', () => {
  const bed = at(12, 23, 0);
  const wake = at(13, 6, 30);

  it('accepts a normal night and counts it toward the morning it ended', () => {
    expect(checkNight(bed, wake, now)).toBeNull();
    expect(nightOf(wake)).toBe('2026-11-13');
    expect(nightOf(at(13, 23, 30))).toBe('2026-11-13');
  });

  it('wants the wake-up time after bedtime', () => {
    expect(checkNight(wake, bed, now)).toMatch(/after bedtime/);
    expect(checkNight(bed, bed, now)).toMatch(/after bedtime/);
  });

  it('allows at most 24 hours', () => {
    const early = at(11, 10);
    expect(checkNight(early, early + MAX_NIGHT_MS, now)).toBeNull();
    expect(checkNight(early, early + MAX_NIGHT_MS + 60_000, now)).toMatch(/24 hours/);
  });

  it('wants the wake-up time no later than now', () => {
    expect(checkNight(bed, now + 60_000, now)).toMatch(/later than now/);
    expect(checkNight(bed, now, now)).toBeNull();
  });

  it('says what a night saved for a morning would run into, however far back', () => {
    const night = (date: string, source: 'manual' | 'health'): SleepEntry => ({
      id: source === 'manual' ? `sleep-${date}` : `health:${date}`,
      date,
      startAt: 0,
      endAt: 1,
      asleepMin: 420,
      rested: null,
      source,
      healthId: source === 'health' ? date : null,
      stages: null,
      updatedAt: 1,
    });
    // Older than the two weeks the list shows.
    const entries = [night('2026-10-20', 'manual'), night('2026-10-21', 'health'), night('2026-10-21', 'manual')];
    expect(nightClash(entries, '2026-10-20', null)).toBe('manual');
    expect(nightClash(entries, '2026-10-21', null)).toBe('health');
    expect(nightClash(entries, '2026-10-22', null)).toBeNull();
    // The night being changed doesn't count against itself.
    expect(nightClash(entries, '2026-10-20', 'sleep-2026-10-20')).toBeNull();
    expect(nightClash(entries, '2026-10-21', 'sleep-2026-10-21')).toBe('health');
  });
});
