/**
 * Today's colours follow the time of day (owner, 17 Nov 2026; docs/design.md
 * "Current: Today Time of day"): Dawn from 05:00, Noon from 11:00, Dusk from
 * 16:30 until the next morning, by the phone's local time. Only Today and the
 * bottom bar use these; every other screen keeps the Calm theme.
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
  /** The ring and the hour bars with steps: ringA to ringB. */
  ringA: string;
  ringB: string;
  /** The ring's track and hours with no steps. */
  track: string;
  food: string;
  foodLane: string;
  sleep: string;
  sleepLane: string;
  water: string;
  waterLane: string;
}

const SHARED = { card: '#FFFFFF', text: '#1F1B16', onMain: '#FFFFFF' } as const;

export const DAY_PALETTES: Record<DayPart, DayPalette> = {
  dawn: {
    ...SHARED,
    bg: '#F8F4EF',
    wash: '#FBE6DA',
    edge: '#F0E6DD',
    newsBg: '#F6E8DF',
    plate: '#F7E3DA',
    muted: '#6E6260',
    main: '#3A2D45',
    heroTop: '#FFF6F0',
    heroBottom: '#FBE4D8',
    heroEdge: '#F5DDD0',
    ringA: '#F09A6B',
    ringB: '#C2577A',
    track: '#F6DCD3',
    food: '#C4652F',
    foodLane: '#FAE6DA',
    sleep: '#6A5BA8',
    sleepLane: '#ECE8F6',
    water: '#3A7FBF',
    waterLane: '#E3EEF8',
  },
  noon: {
    ...SHARED,
    bg: '#F3F6F9',
    wash: '#DDEBF6',
    edge: '#E2E9F0',
    newsBg: '#E3ECF4',
    plate: '#DCE9F4',
    muted: '#5B6875',
    main: '#1D3A5F',
    heroTop: '#F7FBFE',
    heroBottom: '#DDEBF7',
    heroEdge: '#D6E5F2',
    ringA: '#5BB0E6',
    ringB: '#1F5FA8',
    track: '#D5E5F2',
    food: '#D06A3E',
    foodLane: '#FAE7DE',
    sleep: '#5B57A6',
    sleepLane: '#E9E8F6',
    water: '#238C9A',
    waterLane: '#DCF0F2',
  },
  dusk: {
    ...SHARED,
    bg: '#F5F3F9',
    wash: '#E6DFF3',
    edge: '#E8E3F1',
    newsBg: '#EAE5F4',
    plate: '#E6E0F5',
    muted: '#655F78',
    main: '#3B2F66',
    heroTop: '#F8F6FD',
    heroBottom: '#E4DDF3',
    heroEdge: '#DDD5EF',
    ringA: '#A895E8',
    ringB: '#5340A6',
    track: '#E2DCF2',
    food: '#CF7550',
    foodLane: '#FAE8DF',
    sleep: '#2F7A85',
    sleepLane: '#DDEFF1',
    water: '#3A78C0',
    waterLane: '#E1ECF8',
  },
};

/** How far down the screen the wash fades into bg, in dp. */
export const WASH_HEIGHT = 260;
