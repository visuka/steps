/**
 * Shared club goals, marked by the phone. Every goal is counted from the
 * phone's own numbers, the same ones its screens show: steps, active
 * minutes, distance, the longest walk or ride saved today, last night's
 * sleep and a heart rate recorded today; and from what the person logs:
 * blood pressure readings, weight, mood, meals, water, and a
 * nutrient's total from the food log. A captain sees only done or not (and,
 * for steps, the count): no other number ever leaves the phone. Runs when
 * Buddies or Today opens, at most every 15 minutes, and only for clubs
 * where I said yes to goal tracking.
 *
 * A goal marked done stays done, with one exception: a nutrient "at most"
 * goal (calories, salt, added sugar…) goes back to not done when the day's
 * total passes the target later that day.
 * Pure parts are tested in __tests__/goals-auto.test.ts.
 */
import type { BloodPressureEntry, FoodEntry, HeartDay, LogEntry, MoodEntry, Profile, Repository, SleepEntry, Walk } from '@/data/types';
import { mealWord } from '@/components/food/food-result-format';
import { dayKey, parseDayKey, startOfDay } from '@/lib/dates';
import type { ClockStyle } from '@/lib/when';
import type { Units } from '@/lib/format';
import { entryNutrients, type PartialKeys, partialKeys } from '@/nutrition/day';
import { loadFoodBook } from '@/nutrition/notes';
import { sumNutrients } from '@/nutrition/nutrients';
import type { NutrientKey, Nutrients } from '@/nutrition/types';
import { drinkMl } from '@/water/water';

import { dueOn, liveWords, markWords, needsTarget, nutrientDir, type NutrientKnown } from './goals';
import type { ClubCard, ClubGoals, Goal, GoalMark } from './types';

/** The last run: {at, day, clubs (ids where goals are on and I am a member), clubsAt}. */
export const GOALS_AUTO_KEY = 'buddies.goalsAuto';
export const GOALS_AUTO_EVERY_MS = 15 * 60_000;
/** The list of my clubs is asked for again after this, or when the day changes. */
const CLUBS_EVERY_MS = 6 * 60 * 60_000;
/** A steps count is sent again only when it moved this much. */
export const STEPS_VALUE_STEP = 100;

/** Today's own numbers, as the app's screens show them. Never sent anywhere. */
export interface PhoneToday {
  steps: number;
  /** Active minutes, as Today shows them. */
  activeMin: number;
  /** Distance today in metres, as Today shows it. */
  distanceM: number;
  /** The longest walk saved today (not a ride), in minutes moving. */
  walkMin: number;
  /** The longest ride saved today (cycling, indoor bike too), in minutes moving. */
  rideMin: number;
  /** Asleep last night (the night that ended this morning). */
  sleepMin: number;
  /** A heart rate recorded today: from a watch through Health, or a blood pressure reading with a pulse. */
  heart: boolean;
  /** Blood pressure readings taken today. */
  bpReadings: number;
  weightLogged: boolean;
  moodLogged: boolean;
  /** Foods logged today (any entry); an empty log is not yet "at most". */
  foodEntries: number;
  /** Meals logged today, as the Food screen splits the day: breakfast, lunch, snacks, dinner (0 to 4). */
  meals: number;
  waterGlasses: number;
  /** Today's totals from the food log. */
  nutrients: Nutrients;
  /** The nutrients at least one of today's entries knows (a calories-only entry knows only kcal). */
  known: Partial<Record<NutrientKey, true>>;
  /** The nutrients some of today's foods know only partly: the Food screen's "≥". */
  partial: PartialKeys;
}

/** A phone with nothing counted yet. */
export const EMPTY_PHONE: PhoneToday = {
  steps: 0,
  activeMin: 0,
  distanceM: 0,
  walkMin: 0,
  rideMin: 0,
  sleepMin: 0,
  heart: false,
  bpReadings: 0,
  weightLogged: false,
  moodLogged: false,
  foodEntries: 0,
  meals: 0,
  waterGlasses: 0,
  nutrients: {},
  known: {},
  partial: {},
};

export interface AutoDecision {
  done: boolean;
  /** What the phone counted, in the goal's unit (steps, minutes, metres, readings, glasses, the nutrient's unit); 1 or 0 for heart, weight and mood. */
  value: number;
}

const yes = (b: boolean) => (b ? 1 : 0);

/** What the phone says about one goal today; null when it lacks the target it needs. */
export function autoDecision(goal: Pick<Goal, 'kind' | 'target' | 'nutrientKey'>, phone: PhoneToday): AutoDecision | null {
  if (needsTarget(goal.kind) && goal.target === null) return null;
  const t = goal.target ?? 1;
  const whole = (v: number) => Math.max(0, Math.floor(v));
  const reach = (v: number): AutoDecision => ({ done: v >= t, value: v });
  switch (goal.kind) {
    case 'steps':
      return reach(whole(phone.steps));
    case 'active':
      return reach(whole(phone.activeMin));
    case 'distance':
      return reach(whole(phone.distanceM));
    case 'walk':
      return reach(whole(phone.walkMin));
    case 'ride':
      return reach(whole(phone.rideMin));
    case 'sleep':
      return reach(whole(phone.sleepMin));
    case 'heart':
      return reach(yes(phone.heart));
    case 'bp':
      return reach(whole(phone.bpReadings));
    case 'weight':
      return reach(yes(phone.weightLogged));
    case 'mood':
      return reach(yes(phone.moodLogged));
    case 'meals':
      return reach(whole(phone.meals));
    case 'water':
      return reach(whole(phone.waterGlasses));
    case 'nutrient': {
      if (!goal.nutrientKey) return null;
      const total = Math.max(0, phone.nutrients[goal.nutrientKey] ?? 0);
      const value = Number(total.toFixed(3));
      // At most: only while the food log fully knows today's total and it stays at or under it.
      // A nutrient no entry knows, or one only partly known ("≥" on the Food screen), is not yet "at most".
      if (nutrientDir(goal.nutrientKey) === 'most') {
        const sure = !!phone.known[goal.nutrientKey] && !phone.partial[goal.nutrientKey];
        return { done: phone.foodEntries > 0 && sure && total <= t, value };
      }
      return { done: total >= t, value };
    }
    default:
      return null;
  }
}

/** The one kind of goal the phone may mark not done again: a nutrient "at most" goal. */
export const mayUnmark = (goal: Pick<Goal, 'kind' | 'nutrientKey'>): boolean =>
  goal.kind === 'nutrient' && !!goal.nutrientKey && nutrientDir(goal.nutrientKey) === 'most';

/** What the food log knows today of a goal's nutrient, for the row's words. */
export function nutrientKnown(goal: Pick<Goal, 'nutrientKey'>, phone: PhoneToday): NutrientKnown {
  const key = goal.nutrientKey;
  return { entries: phone.foodEntries, known: !!key && !!phone.known[key], partial: !!key && !!phone.partial[key] };
}

/**
 * What my row says about a goal today: done, the phone's count, or not marked
 * yet. A done mark wins, except for a nutrient "at most" goal the phone now
 * sees over (or no longer sure of): the phone's own words, so the row is right
 * before the next run sends "not done".
 */
export function statusWords(
  goal: Pick<Goal, 'kind' | 'target' | 'nutrientKey'>,
  mark: GoalMark | null,
  phone: PhoneToday | null,
  clock: ClockStyle,
  units: Units = 'metric',
): string {
  const d = phone ? autoDecision(goal, phone) : null;
  if (mark?.done && !(d && !d.done && mayUnmark(goal))) return markWords(mark, clock);
  if (d && phone) return liveWords(goal, d.value, units, nutrientKnown(goal, phone));
  // Before the phone's numbers are read: the step total last sent, for steps.
  if (goal.kind === 'steps' && mark?.value !== null && mark?.value !== undefined) return liveWords(goal, mark.value, units);
  return markWords(null, clock);
}

export interface MarkToSend {
  goalId: string;
  done: boolean;
  /** Steps goals only. */
  value?: number;
}

/**
 * The marks to send for a club's goals due today: a goal that has become
 * done, and for steps a count that moved by 100 or more. Never sends "not
 * done" over a done mark, except for a nutrient "at most" goal gone over.
 * Only a steps goal ever carries a number.
 */
export function autoMarks(cg: ClubGoals, phone: PhoneToday, day: string): MarkToSend[] {
  if (!cg.tracked) return [];
  const out: MarkToSend[] = [];
  for (const g of cg.goals) {
    if (!dueOn(g, day)) continue;
    const d = autoDecision(g, phone);
    if (!d) continue;
    const mark = cg.mine.find((m) => m.goalId === g.goalId) ?? null;
    const wasDone = !!mark?.done;
    if (mayUnmark(g)) {
      if (d.done !== wasDone) out.push({ goalId: g.goalId, done: d.done });
      continue;
    }
    const done = wasDone || d.done;
    if (g.kind === 'steps') {
      const value = Math.floor(d.value / STEPS_VALUE_STEP) * STEPS_VALUE_STEP;
      const moved = mark?.value === null || mark?.value === undefined || Math.abs(value - mark.value) >= STEPS_VALUE_STEP;
      if (done !== wasDone || (moved && value > 0)) out.push({ goalId: g.goalId, done, value });
    } else if (done && !wasDone) {
      out.push({ goalId: g.goalId, done: true });
    }
  }
  return out;
}

/** My marks after sending: what the screen shows without asking again. */
export function applyMarks(mine: GoalMark[], sent: (MarkToSend & { at?: number | null })[]): GoalMark[] {
  const out = [...mine];
  for (const s of sent) {
    const i = out.findIndex((m) => m.goalId === s.goalId);
    const old = i >= 0 ? out[i] : null;
    const next: GoalMark = {
      goalId: s.goalId,
      done: s.done,
      at: s.done ? (s.at ?? old?.at ?? null) : null,
      value: s.value ?? old?.value ?? null,
    };
    if (i >= 0) out[i] = next;
    else out.push(next);
  }
  return out;
}

// ── the phone's numbers ─────────────────────────────────────────────────

/** Glasses of water today: water logged plus drinks in food, as the Today water tile counts. */
export function glassesOf(waterMl: number, drinksMl: number, glassMl: number): number {
  return glassMl > 0 ? Math.floor((waterMl + drinksMl) / glassMl) : 0;
}

export function sleepMinOf(entries: Pick<SleepEntry, 'date' | 'asleepMin'>[], today: string): number {
  return Math.round(entries.filter((e) => e.date === today).reduce((sum, e) => sum + Math.max(0, e.asleepMin), 0));
}

/** The longest walk started today, in whole minutes moving; rides do not count. */
export function walkMinOf(walks: Pick<Walk, 'startedAt' | 'movingS' | 'activity'>[], today: string): number {
  let best = 0;
  for (const w of walks) {
    if (w.activity === 'ride' || dayKey(new Date(w.startedAt)) !== today) continue;
    best = Math.max(best, Math.floor(Math.max(0, w.movingS) / 60));
  }
  return best;
}

/** The longest ride started today (outdoor or indoor bike), in whole minutes moving, counted like a walk. */
export function rideMinOf(walks: Pick<Walk, 'startedAt' | 'movingS' | 'activity'>[], today: string): number {
  let best = 0;
  for (const w of walks) {
    if (w.activity !== 'ride' || dayKey(new Date(w.startedAt)) !== today) continue;
    best = Math.max(best, Math.floor(Math.max(0, w.movingS) / 60));
  }
  return best;
}

/** Active minutes as Today shows them: the day's active minutes, or brisk plus running for older rows. */
export function activeMinOf(day: { date: string; activeMin: number | null; briskMin: number | null; runMin: number | null } | null, today: string): number {
  if (!day || day.date !== today) return 0;
  if (day.activeMin !== null) return Math.max(0, Math.round(day.activeMin));
  if (day.briskMin === null && day.runMin === null) return 0;
  return Math.max(0, Math.round((day.briskMin ?? 0) + (day.runMin ?? 0)));
}

/** A heart rate recorded today: a watch's day through Health, or a blood pressure reading with its pulse. */
export function heartToday(days: Pick<HeartDay, 'date' | 'restingBpm' | 'avgBpm' | 'minBpm' | 'maxBpm'>[], bp: Pick<BloodPressureEntry, 'loggedAt' | 'pulse'>[], today: string): boolean {
  const fromWatch = days.some((d) => d.date === today && [d.restingBpm, d.avgBpm, d.minBpm, d.maxBpm].some((v) => typeof v === 'number' && v > 0));
  return fromWatch || bp.some((r) => dayKey(new Date(r.loggedAt)) === today && typeof r.pulse === 'number' && r.pulse > 0);
}

/** Meals in a day's foods, as the Food screen splits them (breakfast, lunch, snacks, dinner). */
export const mealsOf = (foods: Pick<FoodEntry, 'loggedAt'>[]): number => new Set(foods.map((f) => mealWord(f.loggedAt))).size;

/** Readings or log entries taken today. */
export const countToday = (list: { loggedAt: number }[], today: string): number => list.filter((x) => dayKey(new Date(x.loggedAt)) === today).length;

/** Reads today's numbers from the phone. `steps`: the steps on screen, when known. */
export async function readPhoneToday(
  repo: Repository,
  profile: Pick<Profile, 'water'>,
  today: string,
  steps?: number | null,
): Promise<PhoneToday> {
  const start = startOfDay(parseDayKey(today)).getTime();
  const end = start + 36 * 3600_000; // past any day length; only today's entries are kept below
  const [day, logs, foods, book, sleep, walks, hearts, bp, weights, moods] = await Promise.all([
    repo.getDay(today).catch(() => null),
    repo.getLogs('water', 400).catch(() => [] as LogEntry[]),
    repo.getFoods(start, end).catch(() => [] as FoodEntry[]),
    loadFoodBook(repo).catch(() => null),
    repo.getSleep(today, today).catch(() => [] as SleepEntry[]),
    repo.getWalks(20).catch(() => [] as Walk[]),
    repo.getHeartDays(today, today).catch(() => [] as HeartDay[]),
    repo.getBloodPressure(start, end).catch(() => [] as BloodPressureEntry[]),
    repo.getLogs('weight', 20).catch(() => [] as LogEntry[]),
    repo.getMoods(today, today).catch(() => [] as MoodEntry[]),
  ]);
  const waterMl = logs.reduce((a, l) => (dayKey(new Date(l.loggedAt)) === today ? a + l.value : a), 0);
  const todayFoods = foods.filter((f) => dayKey(new Date(f.loggedAt)) === today);
  const drinks = book ? drinkMl(todayFoods, book.own, book.overrides, book.saved) : 0;
  // The Food screen's totals: each entry with the person's own portions (state/use-calories.ts).
  const each = todayFoods.map((f) => (book ? entryNutrients(f, book.own, book.overrides, book.saved) : { kcal: f.kcal }));
  const nutrients = sumNutrients(each);
  const known: Partial<Record<NutrientKey, true>> = {};
  for (const n of each) for (const [k, v] of Object.entries(n) as [NutrientKey, number | undefined][]) if (typeof v === 'number') known[k] = true;
  const todayDay = day && day.date === today ? day : null;
  return {
    steps: Math.max(0, Math.round(steps ?? todayDay?.steps ?? 0)),
    activeMin: activeMinOf(todayDay, today),
    distanceM: Math.max(0, Math.round(todayDay?.distanceM ?? 0)),
    walkMin: walkMinOf(walks, today),
    rideMin: rideMinOf(walks, today),
    sleepMin: sleepMinOf(sleep, today),
    heart: heartToday(hearts, bp, today),
    bpReadings: countToday(bp, today),
    weightLogged: countToday(weights, today) > 0,
    moodLogged: moods.some((m) => m.date === today),
    foodEntries: todayFoods.length,
    meals: mealsOf(todayFoods),
    waterGlasses: glassesOf(waterMl, drinks, profile.water.glassMl),
    nutrients,
    known,
    partial: book ? partialKeys(todayFoods, book.own, book.saved) : {},
  };
}

// ── the runner ──────────────────────────────────────────────────────────

export interface AutoState {
  at: number;
  day: string;
  clubs: string[];
  clubsAt: number;
}

function readState(v: unknown): AutoState | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'number' || typeof o.day !== 'string' || !Array.isArray(o.clubs)) return null;
  return {
    at: o.at,
    day: o.day,
    clubs: o.clubs.filter((c): c is string => typeof c === 'string'),
    clubsAt: typeof o.clubsAt === 'number' ? o.clubsAt : 0,
  };
}

/** Time to look again: never run, another day, or 15 minutes since the last run. */
export function autoDue(state: AutoState | null, today: string, now: number): boolean {
  if (!state || state.day !== today) return true;
  return now - state.at >= GOALS_AUTO_EVERY_MS || now < state.at;
}

/** The clubs to look at: with goals on, and I am a member. */
export const goalClubs = (cards: Pick<ClubCard, 'clubId' | 'goals' | 'myState'>[]) =>
  cards.filter((c) => c.goals && c.myState === 'member').map((c) => c.clubId);

export interface GoalsAutoDeps {
  kv: Pick<Repository, 'getKv' | 'setKv'>;
  api: {
    myClubs: () => Promise<Pick<ClubCard, 'clubId' | 'goals' | 'myState'>[]>;
    clubGoals: (id: string, day: string) => Promise<ClubGoals>;
    putMark: (id: string, goalId: string, day: string, m: { done: boolean; value?: number | null }) => Promise<unknown>;
  };
  phone: () => Promise<PhoneToday>;
  today: string;
  now: number;
  /** Look now even inside the 15 minutes (a club's Goals tab just loaded). */
  force?: boolean;
}

/** Sends what changed; returns how many marks went. Errors leave it for the next run. */
export async function runGoalsAuto({ kv, api, phone, today, now, force = false }: GoalsAutoDeps): Promise<number> {
  const state = readState(await kv.getKv<unknown>(GOALS_AUTO_KEY));
  if (!force && !autoDue(state, today, now)) return 0;
  let clubs = state?.clubs ?? [];
  let clubsAt = state?.clubsAt ?? 0;
  if (!state || state.day !== today || now - clubsAt >= CLUBS_EVERY_MS || now < clubsAt) {
    clubs = goalClubs(await api.myClubs());
    clubsAt = now;
  }
  // Saved first, so a slow or failing run does not repeat every time the screen opens.
  await kv.setKv<AutoState>(GOALS_AUTO_KEY, { at: now, day: today, clubs, clubsAt });
  if (!clubs.length) return 0;
  const numbers = await phone();
  let sent = 0;
  for (const id of clubs) {
    try {
      const cg = await api.clubGoals(id, today);
      for (const m of autoMarks(cg, numbers, today)) {
        try {
          await api.putMark(id, m.goalId, today, m.value === undefined ? { done: m.done } : { done: m.done, value: m.value });
          sent += 1;
        } catch {
          // the next run tries again
        }
      }
    } catch {
      // a club that left or turned goals off: the next list drops it
    }
  }
  return sent;
}
