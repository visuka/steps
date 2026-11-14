/**
 * The food result's numbers and wrapping rules (spec 5.9, 5.10, 7, 10.4, 10.5)
 * as plain functions: no React, no theme, so jest checks them. One layout for
 * every look; the looks only change colours and fonts.
 */

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { splitIngredient } from './food-result-format';

const { space, sizes, type } = CLEAN_SPEC;

export const RESULT = {
  sideMargin: space.sideMargin,
  /** Under the status bar (spec 7: Food result top padding 16). */
  topGap: space.s16,
  topBarHeight: sizes.topBar.height,
  /** Top bar to title. */
  titleGap: space.s8,
  /** Title to hero card. */
  heroGap: space.s16,
  /** Hero card: a minimum, it grows with large text. */
  heroMinHeight: sizes.foodHero.height,
  heroPaddingV: space.s16,
  heroPaddingH: space.s24,
  /** Macro grid columns: 64, 64, 56. */
  macroColumns: [64, 64, 56] as const,
  macroDot: CLEAN_SPEC.radius.dot * 2,
  macroDotGap: space.s8,
  /** Hero card to "Ingredients". */
  ingredientsGap: space.s24,
  /** "Ingredients" heading to its rows is the section header's own gap; rows to "Nutrients". */
  nutrientsGap: space.s16,
  nutrientGroupTop: space.s4,
  ingredientRowHeight: sizes.ingredientRow.height,
  ingredientGap: sizes.ingredientRow.gap,
  circle: CLEAN_SPEC.icon.circle,
  /** The "Show all nutrients" row. */
  showAllHeight: sizes.ingredientRow.height,
  /** Fixed strip: 16 above the buttons, 24 below, 16 between them. */
  footerTop: space.s16,
  footerBottom: space.s24,
  buttonGap: space.s16,
  editWidth: sizes.button.editWidth,
  /** An ingredient name wraps to at most this many lines, then ends with an ellipsis (10.4). */
  ingredientMaxLines: 2,
} as const;

/** Average glyph width as a share of the font size: Poppins is about 0.58, Noto Sans Telugu wider. 0.6 and 0.75 err on the long side. */
export const CHAR_EM = { latin: 0.6, telugu: 0.75 } as const;

/** True when the text has Telugu letters (U+0C00 to U+0C7F). */
export function hasTelugu(text: string): boolean {
  return /[ఀ-౿]/.test(text);
}

/**
 * How many lines `text` takes in `width` dp at `fontSize` (× the phone's font
 * scale, which the app allows up to 1.3): greedy word wrap, a word longer than
 * a line is broken. An estimate that errs long, so a row sized from it never clips.
 */
export function estimateLines(text: string, width: number, fontSize: number, fontScale = 1, charEm: number = CHAR_EM.latin): number {
  const perLine = Math.max(1, Math.floor(width / (fontSize * fontScale * charEm)));
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  let lines = 1;
  let used = 0;
  for (const word of words) {
    let len = [...word].length;
    if (used > 0 && used + 1 + len <= perLine) {
      used += 1 + len;
      continue;
    }
    if (used > 0) {
      lines += 1;
      used = 0;
    }
    while (len > perLine) {
      lines += 1;
      len -= perLine;
    }
    used = len;
  }
  return lines;
}

export interface TitleLayout {
  lines: number;
  /** Never limited: the title wraps, it is never cut (spec 5.10). */
  numberOfLines: undefined;
  /** Height the block needs; the container uses it as a minimum only. */
  height: number;
}

/** The dish title (22/30): wraps without a limit. */
export function titleLayout(text: string, contentWidth: number, fontScale = 1): TitleLayout {
  const size = type.title.size;
  const lines = estimateLines(text, contentWidth, size, fontScale, hasTelugu(text) ? CHAR_EM.telugu : CHAR_EM.latin);
  return { lines, numberOfLines: undefined, height: Math.ceil(lines * type.title.lineHeight * fontScale) };
}

export interface IngredientRowLayout {
  /** Lines the name takes, 1 or 2. */
  lines: number;
  /** The name needed more than 2 lines: it ends with an ellipsis. */
  truncated: boolean;
  /** Row height as a minimum: 48, or more when large text needs it. */
  minHeight: number;
  /** Width the name has beside the circle and the amount. */
  nameWidth: number;
}

/** Width of an amount like "40 g" at 15 dp, estimated. */
function amountWidth(amount: string, fontScale: number): number {
  return Math.ceil([...amount].length * type.body.size * fontScale * CHAR_EM.latin);
}

/**
 * An ingredient row in a screen of `contentWidth` dp (screen width minus the
 * two 24 margins): circle 40, gap 12, name, gap 12, amount. The name wraps to
 * 2 lines at most (spec 10.4) and the row grows from 48 to fit them.
 */
export function ingredientRowLayout(name: string, amount: string, contentWidth: number, fontScale = 1): IngredientRowLayout {
  const nameWidth = Math.max(40, contentWidth - RESULT.circle - RESULT.ingredientGap - RESULT.ingredientGap - amountWidth(amount, fontScale));
  const needed = estimateLines(name, nameWidth, type.body.size, fontScale, hasTelugu(name) ? CHAR_EM.telugu : CHAR_EM.latin);
  const lines = Math.min(RESULT.ingredientMaxLines, needed);
  const textHeight = Math.ceil(lines * type.body.lineHeight * fontScale);
  return {
    lines,
    truncated: needed > RESULT.ingredientMaxLines,
    // 4 above and below keep two lines off the hairline; one line is centred in 48 as drawn.
    minHeight: Math.max(RESULT.ingredientRowHeight, textHeight + space.s8),
    nameWidth,
  };
}

// ── ingredient names: "Dried anchovy (methallu, fried)" → name, note, method ─────

const METHODS = [
  'raw',
  'fried',
  'deep-fried',
  'deep fried',
  'shallow-fried',
  'stir-fried',
  'boiled',
  'steamed',
  'roasted',
  'grilled',
  'baked',
  'cooked',
  'pressure-cooked',
  'stewed',
  'sauteed',
  'sautéed',
  'smoked',
  'toasted',
  'braised',
  'poached',
  'dried',
] as const;

const METHOD_SET: ReadonlySet<string> = new Set(METHODS);

const isMethod = (word: string) => METHOD_SET.has(word.trim().toLowerCase());

export interface IngredientLine {
  /** "Dried anchovy". */
  main: string;
  /** "(methallu)": a bracketed note that is not a cooking method, or null. */
  aside: string | null;
  /** "fried": how it was cooked, or null. Printed after the name as "· fried". */
  method: string | null;
  /** "2": a count after the name, or null. */
  count: string | null;
}

/**
 * Pulls the cooking method out of an ingredient's name: a bracket part
 * ("Egg (boiled)", "Dried anchovy (methallu, fried)") or a word after a comma or
 * dash ("Egg, boiled"). Everything else in a bracket stays a note.
 */
export function ingredientLine(name: string): IngredientLine {
  const p = splitIngredient(name);
  let main = p.main;
  let method: string | null = null;
  let aside = p.aside;

  if (aside) {
    const parts = aside
      .slice(1, -1)
      .split(/[,;/]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const cooking = parts.filter(isMethod);
    const rest = parts.filter((s) => !isMethod(s));
    if (cooking.length) method = cooking.join(', ').toLowerCase();
    aside = rest.length ? `(${rest.join(', ')})` : null;
  }
  const tail = /^(.*\S)\s*(?:,|\s-\s)\s*([A-Za-z-]+)$/.exec(main);
  if (tail && isMethod(tail[2]) && !method) {
    main = tail[1];
    method = tail[2].toLowerCase();
  }
  return { main, aside, method, count: p.count };
}

/** The name in ink, with its bracketed note: "Dried anchovy (methallu)" (spec 5.10). */
export function ingredientTitle(line: IngredientLine): string {
  return line.aside ? `${line.main} ${line.aside}` : line.main;
}

/** What follows the name in muted text: " · fried · 2", or "". */
export function ingredientSuffix(line: IngredientLine): string {
  const parts: string[] = [];
  if (line.method) parts.push(` · ${line.method}`);
  if (line.count) parts.push(` · ${line.count}`);
  return parts.join('');
}

/** The whole name as spoken: "Dried anchovy (methallu), fried". */
export function ingredientSpoken(line: IngredientLine): string {
  const parts = [line.main + (line.aside ? ` ${line.aside}` : ''), line.method, line.count ? `quantity ${line.count}` : null];
  return parts.filter(Boolean).join(', ');
}

// ── ingredient icons (spec 10.5) ───────────────────────────────────────────

export type IngredientIcon = 'fish' | 'egg' | 'onion' | 'tomato' | 'bottle' | 'bowl';

/** Spec 10.5: fish, meat, seafood → fish; egg; onion, garlic, shallot; vegetables and fruit → tomato; oils, ghee, butter, milk, liquids → bottle; else bowl. */
const ICON_WORDS: readonly (readonly [IngredientIcon, readonly string[]])[] = [
  ['egg', ['egg', 'eggs', 'anda', 'guddu', 'muttai']],
  [
    'fish',
    [
      'fish', 'anchovy', 'anchovies', 'sardine', 'mackerel', 'tuna', 'salmon', 'pomfret', 'prawn', 'prawns', 'shrimp', 'crab', 'squid',
      'lobster', 'seafood', 'chepala', 'methallu', 'meat', 'chicken', 'mutton', 'lamb', 'goat', 'beef', 'pork', 'keema', 'turkey', 'duck',
    ],
  ],
  ['onion', ['onion', 'onions', 'garlic', 'shallot', 'shallots', 'ullipaya', 'veluulli']],
  [
    'bottle',
    [
      'oil', 'ghee', 'butter', 'milk', 'cream', 'curd', 'yogurt', 'yoghurt', 'buttermilk', 'water', 'juice', 'stock', 'broth', 'vinegar',
      'coconut milk', 'syrup', 'sauce',
    ],
  ],
  [
    'tomato',
    [
      'tomato', 'tomatoes', 'potato', 'potatoes', 'carrot', 'spinach', 'cabbage', 'cauliflower', 'brinjal', 'eggplant', 'okra', 'beans',
      'peas', 'capsicum', 'pepper', 'chilli', 'chili', 'cucumber', 'gourd', 'pumpkin', 'beetroot', 'radish', 'drumstick', 'gongura',
      'coriander', 'curry leaves', 'mint', 'lemon', 'lime', 'mango', 'banana', 'apple', 'orange', 'papaya', 'guava', 'ginger', 'greens',
      'vegetable', 'vegetables', 'fruit', 'fruits',
    ],
  ],
];

/** The icon for an ingredient, from the words of its name. */
export function ingredientIcon(name: string): IngredientIcon {
  const words = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(/[^a-zఀ-౿]+/)
    .filter(Boolean);
  const text = ` ${words.join(' ')} `;
  for (const [icon, list] of ICON_WORDS) {
    if (list.some((w) => text.includes(` ${w} `))) return icon;
  }
  return 'bowl';
}

// ── the fixed button strip (spec 10.5) ─────────────────────────────────────

/** True while some of the content is still scrolled under the button strip: its hairline top border shows then. */
export function contentUnderFooter(contentHeight: number, viewHeight: number, scrollY: number): boolean {
  if (!(contentHeight > 0) || !(viewHeight > 0)) return false;
  return contentHeight - (scrollY + viewHeight) > 1;
}

// ── hero card: kcal row, macro grid and donut (spec 10.4) ──────────────────

/** Widest sizes any look uses: numeral 48, macro value 18, macro label 13, "kcal" 15. Errs wide. */
const HERO_TYPE = { numeral: 48, unit: 15, macroValue: 18, macroLabel: 13 } as const;
const MACRO_LABELS = ['Protein', 'Carbs', 'Fat'] as const;

export interface HeroFit {
  /** The donut sits below the text because the number alone is wider than the space beside the donut. */
  stacked: boolean;
  /** Width the kcal row and the macro grid have. */
  availWidth: number;
  /** Lines the kcal row takes: 2 when "kcal" drops under the number. */
  kcalLines: 1 | 2;
  /** Lines the macro grid takes (it wraps to the next line, never overflows). */
  macroLines: number;
  /** Nothing is wider than its space even after wrapping. */
  fits: boolean;
}

/**
 * Hero card arithmetic. `width` is the card's outer width (screen minus the two
 * 24 margins); the card pads 24 each side, the donut is 88 with an 8 gap. The
 * kcal row and the macro cells wrap, and the donut drops below when the number
 * alone will not fit beside it. Text is never shrunk below its spec size.
 */
export function heroFits(width: number, fontScale: number, kcalText: string, macroTexts: readonly string[]): HeroFit {
  const inner = Math.max(0, width - 2 * RESULT.heroPaddingH);
  const gap = space.s8;
  const glyph = (text: string, size: number) => Math.ceil([...text].length * size * fontScale * CHAR_EM.latin);

  const numeralW = glyph(kcalText, HERO_TYPE.numeral);
  const unitW = glyph('kcal', HERO_TYPE.unit);
  const beside = Math.max(0, inner - sizes.foodHero.donut - gap);
  const stacked = numeralW > beside;
  const availWidth = stacked ? inner : beside;
  const kcalLines = numeralW + gap + unitW <= availWidth ? 1 : 2;

  const cells = macroTexts.map((t, i) => {
    const label = glyph(MACRO_LABELS[i] ?? 'Protein', HERO_TYPE.macroLabel);
    const value = RESULT.macroDot + RESULT.macroDotGap + glyph(t, HERO_TYPE.macroValue);
    return Math.max(RESULT.macroColumns[i] ?? RESULT.macroColumns[0], value, label);
  });
  let macroLines = cells.length ? 1 : 0;
  let used = 0;
  for (const c of cells) {
    if (used > 0 && used + c > availWidth) {
      macroLines += 1;
      used = 0;
    }
    used += c;
  }
  const fits = numeralW <= availWidth && cells.every((c) => c <= availWidth);
  return { stacked, availWidth, kcalLines, macroLines, fits };
}
