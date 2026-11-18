/**
 * The plain look, sage and sand (owner, 17 Nov 2026: "Let us finalise on sage
 * plus sand"; "I need the app exactly as in the mock.. pixel to pixel"), as
 * mock d38 (owner approved 18 Nov 2026; docs/design.md and
 * docs/design/plain-sage-sand/plain.html?k=1&ic=1&icx=1&f=4&b=1&h=1&d=38),
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
  /** Notes, units, the date line, times: dark enough for 4.5:1 on every tile (d38). */
  muted: '#5E5E63',
  /** Labels in tracked capitals (d38). */
  label: '#55555A',
  /** The page: a soft grey wash at 170°, with two white glows and one grey (the mockup's blurred blobs). */
  ground: { top: '#F5F5F6', mid: '#ECECEE', bottom: '#F3F3F4', glow: '#FFFFFF', shade: '#DADADE' },
  /** A plain tile: frosted white on the grey. */
  tile: '#F8F8F9',
  tileEdge: '#FFFFFF',
  /** Sage: the main colour, deep enough for white words at 4.5:1 (d38). */
  main: '#567565',
  onMain: '#FFFFFF',
  /** The top tile on each screen, faintly sage. */
  hero: '#DEE4E2',
  heroEdge: '#D3DDD8',
  /** Sand: the second colour, as a tile, a badge and a soft chip. The badge's deep sand carries white at 4.5:1 (d38). */
  sand: '#876644',
  second: '#F2EAE1',
  secondEdge: '#EFE3D6',
  chip: '#F2E9DE',
  /** A chip inside the sand tile. */
  chipOnSecond: '#FCFBF9',
  /** The selected side of a second switch on a screen (Today / Week): white, so only one pill per screen is sage (d38). */
  quietOn: '#FFFFFF',
  /** The search field and the white round buttons. */
  field: '#FFFFFF',
  fieldEdge: '#E8E8EB',
  hairline: '#E4E4E7',
  /** Pressed ripples. */
  ripple: '#2C2C2E14',
} as const;

/**
 * Every text box in the app (settings, sign-in, search, chat): white, a grey
 * hairline all round, pill corners. A box of several lines takes radius 16.
 */
export const PLAIN_FIELD = { backgroundColor: PLAIN.field, borderWidth: 1, borderColor: PLAIN.fieldEdge, borderRadius: 21 } as const;

/** The soft lift under every tile, round button and switch. */
export const PLAIN_SHADOW = '0px 8px 24px rgba(40, 40, 50, 0.06)';

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
  /** Space between tiles: 9 on every screen. Today gave its 12 to the ad space (d38). */
  gap: 9,
  radius: 24,
  pad: { v: 14, h: 18 },
  /** Today's tiles; on a short screen they take `pad` (d38). */
  padRoomy: { v: 18, h: 20 },
  /** No text is drawn smaller than this, even on a small phone (rule: smallest text 11 dp). */
  minText: 11,
  round: 40,
  switchH: 40,
  /** The status bar's height on the mockup's phone: the top row sits 6 dp under it. */
  topUnderStatus: 6,
} as const;

/**
 * Faces: Figtree for words; Outfit for figures, labels and the switch ("Outfit thin", owner 18 Nov 2026,
 * mock plain.html f=4). Each weight is its own family on Android (a fontWeight on a custom face falls
 * back to the system font), loaded from assets/fonts (constants/themes/fonts.ts).
 */
export const PLAIN_FONT = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  /** Big and tile figures: Outfit 300 (d38, owner: "a little bolder"). */
  figure: 'Outfit_300Light',
  /** Middle figures ("78%", "320"): Outfit 400 (d38). */
  mid: 'Outfit_400Regular',
  /** Labels in tracked capitals and the switch: Outfit 500. */
  caps: 'Outfit_500Medium',
} as const;
