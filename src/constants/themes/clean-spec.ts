/**
 * The Clean+ blue spec, typed. Every value is copied from docs/design/spec.md,
 * which is read from the approved mockup docs/design/clean-plus.html.
 * 1 mockup px = 1 dp. Do not change a value to suit the code: the mockup wins.
 * src/constants/__tests__/clean-spec.test.ts checks this file against the HTML.
 */

export const CLEAN_SPEC = {
  fonts: {
    family: 'Poppins',
    telugu: 'Noto Sans Telugu',
    /** Android family names registered in T3 (one per weight). */
    android: {
      light: 'Poppins_300Light',
      regular: 'Poppins_400Regular',
      medium: 'Poppins_500Medium',
      telugu: 'NotoSansTelugu_400Regular',
    },
  },

  colors: {
    ink: '#111827',
    muted: '#5F6673',
    accent: '#1F4FD8',
    accentTint: '#E8EEFC',
    accentMid: '#DCE4FA',
    warm: '#C8601F',
    warmTint: '#FBEEE4',
    indigo: '#5A5F86',
    indigoTint: '#EDEEF5',
    hair: '#EEF0F3',
    soft: '#F3F4F6',
    warn: '#B42318',
    warnTint: '#FDECEA',
    onBlue: '#D6E0FA',
    white: '#FFFFFF',
    heroPill: '#3B66E0',
    heroBarQuiet: '#6A8BE6',
    heroGoalLine: '#A9BEF2',
    selectedTrack: '#C3D1F6',
    carbs: '#9AA1AC',
    mapLand: '#F1F3F6',
    mapWater: '#DCE5FA',
    mapBlock: '#E6E9EE',
    mapDot: '#D9DDE4',
  },

  /** Colour custom properties in the mockup's :root, mapped to the names above. (The 15th, --sh, is shadow.card.) */
  cssVars: {
    '--accent': 'accent',
    '--accent-t': 'accentTint',
    '--accent-m': 'accentMid',
    '--warm': 'warm',
    '--warm-t': 'warmTint',
    '--indigo': 'indigo',
    '--indigo-t': 'indigoTint',
    '--ink': 'ink',
    '--muted': 'muted',
    '--hair': 'hair',
    '--soft': 'soft',
    '--warn': 'warn',
    '--warn-t': 'warnTint',
    '--onblue': 'onBlue',
  },

  /** Type scale: size and lineHeight in dp, weight as a CSS number, letterSpacing in dp. */
  type: {
    caption: { css: 's13', size: 13, lineHeight: 18, weight: 400, letterSpacing: 0 },
    body: { css: 's15', size: 15, lineHeight: 22, weight: 400, letterSpacing: 0 },
    value: { css: 's18', size: 18, lineHeight: 24, weight: 500, letterSpacing: 0 },
    title: { css: 's22', size: 22, lineHeight: 30, weight: 500, letterSpacing: 0 },
    display: { css: 's52', size: 52, lineHeight: 56, weight: 300, letterSpacing: -1.04 },
    /** The Telugu line under a dish name. */
    telugu: { css: 'te', size: 15, lineHeight: 24, weight: 400, letterSpacing: 0 },
    /** The one exception: the removed "Car" row title. */
    carTitle: { css: 's15', size: 15, lineHeight: 20, weight: 400, letterSpacing: 0 },
  },

  weights: { light: 300, regular: 400, medium: 500 },

  radius: {
    bar: 2,
    track: 4,
    dot: 4,
    dayChip: 12,
    pill: 12,
    button: 16,
    segment: 16,
    circle: 20,
    well: 20,
    chip: 20,
    card: 24,
    tile: 24,
    hero: 24,
    map: 24,
    fab: 28,
  },

  space: { s4: 4, s8: 8, s12: 12, s16: 16, s24: 24, sideMargin: 24 },

  /** RN boxShadow strings (CSS syntax). */
  shadow: {
    card: '0 1px 2px rgba(17,24,39,.04), 0 8px 24px rgba(17,24,39,.06)',
    fab: '0 8px 20px rgba(17,24,39,.14)',
    segment: '0 2px 8px rgba(17,24,39,.06)',
  },

  icon: { size: 20, viewBox: 24, strokeWidth: 1.5, circle: 40, cap: 'round', join: 'round' },

  sizes: {
    phoneWidth: 390,
    phoneHeight: 844,
    nav: { height: 72, slot: 48, dot: 4, fab: 56, fabLift: 7.5, sidePadding: 16, minTouch: 48 },
    button: { height: 48, editWidth: 112 },
    greeting: { height: 48, avatar: 40 },
    week: { dayWidth: 40, dayHeight: 60, trackWidth: 8, trackHeight: 24 },
    hero: { height: 226, padding: 24, chartHeight: 64, barWidth: 6, tallestBar: 60, quietBar: 3 },
    tile: { height: 146, padding: 16, gap: 16, pipHeight: 4, pipGap: 4, pips: 8 },
    pill: { height: 24, paddingX: 8 },
    bar: { height: 4 },
    segmented: { width: 216, height: 40, padding: 4 },
    chip: { height: 40 },
    foodHero: { height: 136, donut: 88, donutRadius: 36, donutStroke: 10, donutGap: 3 },
    ingredientRow: { height: 48, partsHeight: 56, gap: 12 },
    nutrientRow: { height: 28, nameWidth: 140, valueWidth: 88, gap: 12 },
    map: { height: 160 },
    statCard: { height: 72 },
    sparkline: { width: 128, height: 32 },
    topBar: { height: 40 },
  },
} as const;

export type CleanSpec = typeof CLEAN_SPEC;
export type CleanColor = keyof typeof CLEAN_SPEC.colors;
