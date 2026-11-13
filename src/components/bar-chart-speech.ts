/** What TalkBack says for a bar chart. Plain functions, so jest can check them. */

export interface SpokenBar {
  key: string;
  value: number;
  label: string;
}

/** An hour of the day as people say it: 0 → "12 am", 13 → "1 pm". */
export function hourName(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${h < 12 ? 'am' : 'pm'}`;
}

/**
 * One spoken line for a chart that isn't tappable bar by bar, e.g.
 * "Steps by hour. Most at 6 pm, 2,140 steps." `describe` names one bar
 * with its unit.
 */
export function chartSummary(name: string, bars: SpokenBar[], describe: (bar: SpokenBar) => string): string {
  const top = bars.reduce<SpokenBar | null>((best, b) => (b.value > 0 && (!best || b.value > best.value) ? b : best), null);
  return top ? `${name}. Most at ${describe(top)}.` : `${name}. Nothing yet.`;
}
