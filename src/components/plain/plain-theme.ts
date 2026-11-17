/**
 * The plain look, sage and sand (owner, 17 Nov 2026: "Let us finalise on sage
 * plus sand"; "I need the app exactly as in the mock.. pixel to pixel").
 * Every value is the mockup's (glass-mockups/plain.html?k=1&ic=1&icx=1),
 * 1 mockup px = 1 dp at 411 dp wide. Colours were read off the mockup's
 * screenshots, so a tile drawn here matches the glass over the grey ground.
 *
 * Colour sits on surfaces only (the selected switch, the top tile, buttons,
 * the sand tile, chips and avatars). Words and numbers stay black and grey;
 * each label's icon has its own colour.
 */

export const PLAIN = {
  /** Words and numbers. */
  text: '#2C2C2E',
  /** Labels, notes, units. */
  muted: '#8E8E93',
  /** The page: a soft grey wash at 170°, with two white glows and one grey (the mockup's blurred blobs). */
  ground: { top: '#F5F5F6', mid: '#ECECEE', bottom: '#F3F3F4', glow: '#FFFFFF', shade: '#DADADE' },
  /** A plain tile: frosted white on the grey. */
  tile: '#F8F8F9',
  tileEdge: '#FFFFFF',
  /** Sage: the main colour. */
  main: '#5E7E6F',
  onMain: '#FFFFFF',
  /** The top tile on each screen, faintly sage. */
  hero: '#DEE4E2',
  heroEdge: '#D3DDD8',
  /** Sand: the second colour, as a tile, a badge and a soft chip. */
  sand: '#C9A47C',
  second: '#F2EAE1',
  secondEdge: '#EFE3D6',
  chip: '#F2E9DE',
  /** A chip inside the sand tile. */
  chipOnSecond: '#FCFBF9',
  /** The search field and the white round buttons. */
  field: '#FFFFFF',
  fieldEdge: '#E8E8EB',
  hairline: '#E4E4E7',
  /** Pressed ripples. */
  ripple: '#2C2C2E14',
} as const;

/** Each label icon's own colour. */
export const PLAIN_ICON_COLOR = {
  steps: '#2F9A68',
  pin: '#D0614E',
  bolt: '#D9962B',
  bowl: '#E07B39',
  moon: '#5B5FC7',
  drop: '#2F86C9',
  walk: '#2F9A68',
  flame: '#E0663A',
  plus: '#2F9A68',
  list: '#5B6878',
  leaf: '#4C9A52',
  chat: '#3E7CC4',
  useradd: '#2E918A',
  search: '#3E6888',
  people: '#7C6CC4',
  card: '#B08550',
  spark: '#C9A23C',
  lock: '#8E8E93',
} as const;

export type PlainIconName = keyof typeof PLAIN_ICON_COLOR;

/** Sizes in dp, as the mockup (before scaled()). */
export const PLAIN_SIZE = {
  gutter: 18,
  /** Space between tiles: 9 on Nutrition and Meet, 12 on Activity ("roomy"). */
  gap: 9,
  gapRoomy: 12,
  radius: 24,
  pad: { v: 14, h: 18 },
  padRoomy: { v: 18, h: 20 },
  round: 40,
  switchH: 40,
  /** The status bar's height on the mockup's phone: the top row sits 6 dp under it. */
  topUnderStatus: 6,
} as const;

/** Faces: Figtree for words, the phone's condensed Roboto for figures, monospace for labels. */
export const PLAIN_FONT = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  /** Light condensed (the big figures): Android names the 300 face on its own; a weight on the family drew it heavy (CI run 44137089959). */
  condensedLight: 'sans-serif-condensed-light',
  condensed: 'sans-serif-condensed',
  mono: 'monospace',
} as const;
