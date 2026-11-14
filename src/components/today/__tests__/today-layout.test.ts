import { describe, expect, it } from '@jest/globals';

import { avatarInitial, greetingFor, greetingWords, sleepSpoken, walkSpoken, type SleepFigure, type WalkFigure, type WeekDay } from '../model';
import {
  AXIS_LABELS,
  contentWidth,
  foodTile,
  heroChartWidth,
  heroNumbers,
  heroPill,
  heroRight,
  lockedTileModel,
  pipsFor,
  selectedDay,
  sleepTile,
  sleepValue,
  tileWidth,
  TILE_KINDS,
  TODAY_LAYOUT,
  walkNote,
  walkTile,
  waterTile,
  waterValue,
  weekShares,
} from '../today-layout';

const sleep: SleepFigure = { h: 6, m: 50, spoken: '6 hours 50 minutes' };
const walk: WalkFigure = {
  id: 'w1',
  title: 'Morning walk',
  time: '7:10 am',
  distance: { value: '2.3', unit: 'km' },
  durationMin: 32,
  steps: 3120,
};

function day(i: number, steps: number): WeekDay {
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return { key: `2026-11-${8 + i}`, letter: names[i][0], name: names[i], steps, today: i === 6 };
}

describe('greeting', () => {
  it('picks the words by hour: morning < 12, afternoon < 17, evening after', () => {
    expect(greetingWords(0)).toBe('Good morning');
    expect(greetingWords(11)).toBe('Good morning');
    expect(greetingWords(12)).toBe('Good afternoon');
    expect(greetingWords(16)).toBe('Good afternoon');
    expect(greetingWords(17)).toBe('Good evening');
    expect(greetingWords(23)).toBe('Good evening');
  });

  it('adds the name, or stands alone without one', () => {
    expect(greetingFor(9, 'Ravi')).toBe('Good morning, Ravi');
    expect(greetingFor(9, null)).toBe('Good morning');
    expect(greetingFor(18, '  ')).toBe('Good evening');
  });

  it('takes the avatar letter from the name', () => {
    expect(avatarInitial('ravi')).toBe('R');
    expect(avatarInitial(null)).toBe('');
  });
});

describe('hero', () => {
  it('writes distance and active minutes, zeros on an empty day', () => {
    expect(heroRight({ value: '4.6', unit: 'km' }, 52)).toBe('4.6 km · 52 min active');
    expect(heroRight(null, null)).toBe('0 km · 0 min active');
    expect(heroRight(null, null, 'mi')).toBe('0 mi · 0 min active');
    expect(heroRight({ value: '0.0', unit: 'mi' }, 0)).toBe('0 mi · 0 min active');
  });

  it('shows the real share in the pill, over the goal too', () => {
    expect(heroPill(78)).toBe('78%');
    expect(heroPill(0)).toBe('0%');
    expect(heroPill(112)).toBe('112%');
  });

  it('formats the number and the goal', () => {
    expect(heroNumbers(6240, 8000)).toEqual({ value: '6,240', of: 'of 8,000' });
    expect(heroNumbers(0, 8000)).toEqual({ value: '0', of: 'of 8,000' });
  });

  it('labels the chart axis in four columns', () => {
    expect(AXIS_LABELS).toEqual(['12 am', '6', '12 pm', '6']);
  });
});

describe('widths on wider phones', () => {
  it('shares the content width in two columns with a 16 gap', () => {
    expect(tileWidth(contentWidth(390))).toBe(163);
    expect(tileWidth(contentWidth(411))).toBe(173.5);
  });

  it('grows the hero chart with the screen: 294 at 390', () => {
    expect(heroChartWidth(contentWidth(390))).toBe(294);
    expect(heroChartWidth(contentWidth(411))).toBe(411 - 48 - 48);
  });

  it('caps the content at the maximum width', () => {
    expect(contentWidth(1000, 24, 640)).toBe(640 - 48);
    expect(contentWidth(10, 24)).toBe(0);
  });

  it('keeps the spec gaps', () => {
    expect(TODAY_LAYOUT.blockGap).toBe(16);
    expect(TODAY_LAYOUT.tileGap).toBe(16);
    expect(TODAY_LAYOUT.topPadding).toBe(24);
    expect(TODAY_LAYOUT.hero.minHeight).toBe(226);
  });
});

describe('week strip', () => {
  it('gives each day its share of the goal, clamped, today selected', () => {
    const week = [day(0, 7200), day(1, 8000), day(2, 4800), day(3, 6800), day(4, 12000), day(5, 0), day(6, 6240)];
    const shares = weekShares(week, 8000);
    expect(shares.map((d) => d.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(shares[0].share).toBeCloseTo(0.9);
    expect(shares[1].share).toBe(1);
    expect(shares[4].share).toBe(1);
    expect(shares[6].share).toBeCloseTo(0.78);
    expect(selectedDay(week)).toBe(6);
  });

  it('draws no data for a past day with 0 steps, a 0 share for today', () => {
    const shares = weekShares([day(5, 0), day(6, 0)], 8000);
    expect(shares[0].share).toBeNull();
    expect(shares[1].share).toBe(0);
  });

  it('survives a goal of 0', () => {
    expect(weekShares([day(6, 100)], 0)[0].share).toBe(0);
  });
});

describe('Food tile', () => {
  const base = { text: '1,280', target: '1,900', share: 1280 / 1900, spoken: 'Food, 1,280 of about 1,900 kcal' };

  it('normal: value, nested unit, share of the goal, chevron', () => {
    const t = foodTile(base);
    expect(t).toMatchObject({ label: 'Food', value: '1,280', unit: 'of 1,900 kcal', trailing: 'chevron', spoken: base.spoken });
    expect(t.share).toBeCloseTo(0.674, 2);
  });

  it('empty: zero and an empty track', () => {
    expect(foodTile({ ...base, text: '0', share: 0 })).toMatchObject({ value: '0', share: 0 });
    expect(foodTile({ ...base, text: '', share: 0 }).value).toBe('0');
  });

  it('over the goal: the fill stops at full', () => {
    expect(foodTile({ ...base, text: '2,400', share: 1.26 }).share).toBe(1);
  });

  it('partial: at least, once', () => {
    expect(foodTile({ ...base, partial: true }).value).toBe('≥ 1,280');
    expect(foodTile({ ...base, text: '≥ 1,280', partial: true }).value).toBe('≥ 1,280');
  });
});

describe('Water tile', () => {
  it('writes the value and unit with and without a target', () => {
    expect(waterValue(5, 8)).toEqual({ value: '5', unit: 'of 8 glasses' });
    expect(waterValue(0, 8)).toEqual({ value: '0', unit: 'of 8 glasses' });
    expect(waterValue(5, null)).toEqual({ value: '5', unit: 'glasses' });
    expect(waterValue(1, null)).toEqual({ value: '1', unit: 'glass' });
  });

  it('fills pips by share of the target: 5 of 8 is 5 of 8', () => {
    expect(pipsFor(5, 8)).toEqual({ total: 8, filled: 5 });
    expect(pipsFor(0, 8)).toEqual({ total: 8, filled: 0 });
    expect(pipsFor(5, 10)).toEqual({ total: 8, filled: 4 });
    expect(pipsFor(1, 20)).toEqual({ total: 8, filled: 1 });
    expect(pipsFor(12, 8)).toEqual({ total: 8, filled: 8 });
  });

  it('without a target fills one pip a glass, up to eight', () => {
    expect(pipsFor(3, null).filled).toBe(3);
    expect(pipsFor(11, null).filled).toBe(8);
    expect(pipsFor(0, null).filled).toBe(0);
  });

  it('has a plus in the header and the spoken text', () => {
    expect(waterTile({ glasses: 5, of: 8, spoken: 'Water, 5 glasses of 8' })).toMatchObject({
      label: 'Water',
      value: '5',
      unit: 'of 8 glasses',
      trailing: 'plus',
      pips: { total: 8, filled: 5 },
      spoken: 'Water, 5 glasses of 8',
    });
  });
});

describe('Sleep tile', () => {
  it('writes hours and minutes, the unit "min"', () => {
    expect(sleepValue(sleep)).toEqual({ value: '6 h 50', unit: 'min' });
  });

  it('fills the bar by share of 8 h: 6 h 50 is 85%', () => {
    const t = sleepTile(sleep, sleepSpoken(sleep));
    expect(t.share).toBeCloseTo(0.854, 2);
    expect(t).toMatchObject({ label: 'Sleep', trailing: 'chevron', spoken: 'Sleep, 6 hours 50 minutes' });
  });

  it('caps a long night at a full bar', () => {
    expect(sleepTile({ ...sleep, h: 10, m: 5 }, '').share).toBe(1);
  });

  it('no data: a dash, no unit, an empty track, the chevron stays', () => {
    expect(sleepValue(null)).toEqual({ value: '—' });
    expect(sleepTile(null, sleepSpoken(null))).toEqual({
      label: 'Sleep',
      value: '—',
      unit: undefined,
      trailing: 'chevron',
      share: 0,
      spoken: 'Sleep, no data',
    });
  });
});

describe('Walk tile', () => {
  it('with a walk: its title, distance, time pill and note', () => {
    expect(walkTile(walk, walkSpoken(walk))).toEqual({
      label: 'Morning walk',
      value: '2.3',
      unit: 'km',
      trailing: 'pill',
      pill: '7:10 am',
      note: '32 min · 3,120 steps',
      spoken: 'Morning walk, 2.3 km, 32 minutes, 3,120 steps',
    });
  });

  it('leaves out what is unknown from the note', () => {
    expect(walkNote({ ...walk, steps: null })).toBe('32 min');
    expect(walkNote({ ...walk, durationMin: null })).toBe('3,120 steps');
    expect(walkNote({ ...walk, durationMin: null, steps: null })).toBeUndefined();
  });

  it('no walk: "Walk", "No walk yet", no pill, no note, the chevron', () => {
    expect(walkTile(null, walkSpoken(null))).toEqual({
      label: 'Walk',
      value: 'No walk yet',
      trailing: 'chevron',
      spoken: 'Walk, no walk yet today',
    });
  });

  it('says one minute in the singular', () => {
    expect(walkSpoken({ ...walk, durationMin: 1, steps: null })).toBe('Morning walk, 2.3 km, 1 minute');
  });
});

describe('Premium-locked tiles (spec 10.3)', () => {
  it('are the same four tiles, in order, each saying Premium with a chevron', () => {
    expect(TILE_KINDS).toEqual(['food', 'water', 'sleep', 'walk']);
    expect(TILE_KINDS.map((k) => lockedTileModel(k))).toEqual([
      { label: 'Food', value: 'Premium', trailing: 'chevron', locked: true, spoken: 'Food, Premium' },
      { label: 'Water', value: 'Premium', trailing: 'chevron', locked: true, spoken: 'Water, Premium' },
      { label: 'Sleep', value: 'Premium', trailing: 'chevron', locked: true, spoken: 'Sleep, Premium' },
      { label: 'Walk', value: 'Premium', trailing: 'chevron', locked: true, spoken: 'Walk, Premium' },
    ]);
  });

  it('carry no unit, bar, pips, pill or note', () => {
    const t = lockedTileModel('water');
    expect(t.unit).toBeUndefined();
    expect(t.share).toBeUndefined();
    expect(t.pips).toBeUndefined();
    expect(t.pill).toBeUndefined();
    expect(t.note).toBeUndefined();
  });
});
