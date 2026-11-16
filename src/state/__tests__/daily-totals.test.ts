import { describe, expect, it } from '@jest/globals';

import { averageOfLogged, dayKeysEnding, totalsByDay } from '../daily-totals';

describe('daily totals for the Week and Month charts', () => {
  it('lists the days ending today, oldest first', () => {
    expect(dayKeysEnding('2026-11-16', 3)).toEqual(['2026-11-14', '2026-11-15', '2026-11-16']);
    expect(dayKeysEnding('2026-03-01', 2)).toEqual(['2026-02-28', '2026-03-01']);
  });

  it('adds each item to its day, keeps empty days at 0 and leaves out days outside', () => {
    const keys = dayKeysEnding('2026-11-16', 3);
    const items = [
      { d: '2026-11-14', v: 250 },
      { d: '2026-11-14', v: 250 },
      { d: '2026-11-16', v: 300 },
      { d: '2026-11-10', v: 999 },
      { d: '2026-11-16', v: Number.NaN },
      { d: '2026-11-16', v: -5 },
    ];
    expect(totalsByDay(keys, items, (i) => i.d, (i) => i.v)).toEqual([
      { key: '2026-11-14', value: 500 },
      { key: '2026-11-15', value: 0 },
      { key: '2026-11-16', value: 300 },
    ]);
  });

  it('averages only the days with something logged', () => {
    expect(averageOfLogged([{ key: 'a', value: 500 }, { key: 'b', value: 0 }, { key: 'c', value: 300 }])).toBe(400);
    expect(averageOfLogged([{ key: 'a', value: 0 }])).toBe(0);
  });
});
