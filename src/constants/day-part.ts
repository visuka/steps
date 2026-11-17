/**
 * Today's parts of the day: Dawn from 05:00, Noon from 11:00, Dusk from 16:30
 * until the next morning, by the phone's local time. Since 17 Nov 2026 all
 * three share one grey, black and red palette (MONO below), as does every
 * other screen through the Calm theme (themes/e.ts).
 */

export type DayPart = 'dawn' | 'noon' | 'dusk';

export const DAY_PARTS: readonly DayPart[] = ['dawn', 'noon', 'dusk'];

/** Where each part starts, in minutes after local midnight. */
export const DAY_PART_START = { dawn: 5 * 60, noon: 11 * 60, dusk: 16 * 60 + 30 } as const;

export function dayPartOf(d: Date): DayPart {
  const m = d.getHours() * 60 + d.getMinutes();
  if (m >= DAY_PART_START.dawn && m < DAY_PART_START.noon) return 'dawn';
  if (m >= DAY_PART_START.noon && m < DAY_PART_START.dusk) return 'noon';
  return 'dusk';
}

export function isDayPart(x: unknown): x is DayPart {
  return x === 'dawn' || x === 'noon' || x === 'dusk';
}

export interface DayPalette {
  /** The screen behind the cards. */
  bg: string;
  /** The top of the screen; fades to bg by WASH_HEIGHT. */
  wash: string;
  /** Card borders and the bar's hairline. */
  edge: string;
  newsBg: string;
  /** The avatar and the walk circle. */
  plate: string;
  /** Second text. */
  muted: string;
  /** Log food, the active tab, the avatar letter, the news label text. */
  main: string;
  /** Text on main. */
  onMain: string;
  card: string;
  /** Main text. */
  text: string;
  /** The steps card: a 150° gradient from heroTop to heroBottom. */
  heroTop: string;
  heroBottom: string;
  heroEdge: string;
  /** The hour dots with steps (ringA) and the goal bar up to the goal (ringB). */
  ringA: string;
  ringB: string;
  /** The ring's track and hours with no steps. */
  track: string;
  /** The one colour: the hour now, steps past the goal. */
  accent: string;
  food: string;
  foodLane: string;
  sleep: string;
  sleepLane: string;
  water: string;
  waterLane: string;
}

/**
 * One look for the whole day (owner, 17 Nov 2026: "every screen to this colour
 * combination"): a light grey ground, near-white cards, black for text, the
 * main action and the data, greys for second text, tracks and dots, and one
 * red for the hour now and steps past the goal. Dawn, Noon and Dusk keep
 * their names (the preview's &part= still works) but share these colours.
 */
const MONO: DayPalette = {
  bg: '#F1F1F1',
  wash: '#F1F1F1',
  edge: '#E4E4E4',
  newsBg: '#E8E8E8',
  plate: '#E8E8E8',
  muted: '#5E5E5E',
  main: '#000000',
  onMain: '#FFFFFF',
  card: '#FBFBFB',
  text: '#000000',
  heroTop: '#FBFBFB',
  heroBottom: '#FBFBFB',
  heroEdge: '#E4E4E4',
  ringA: '#8C8C8C',
  ringB: '#000000',
  track: '#DCDCDC',
  accent: '#FD393A',
  food: '#000000',
  foodLane: '#DCDCDC',
  sleep: '#000000',
  sleepLane: '#DCDCDC',
  water: '#2B70AE',
  waterLane: '#A9D4F5',
};

export const DAY_PALETTES: Record<DayPart, DayPalette> = { dawn: MONO, noon: MONO, dusk: MONO };

/** How far down the screen the wash fades into bg, in dp. */
export const WASH_HEIGHT = 260;
