/**
 * The design was drawn for a phone about 411 dp wide (a Pixel 6 at its
 * default display size, where the CI photos are taken). A narrower screen,
 * or a phone set to a larger display size (many are 360 dp wide), would
 * otherwise show the same sizes in less room and look oversized. Text and
 * spacing scale down with the width, never below 85% and never up.
 */
export const DESIGN_WIDTH = 411;

/** How much smaller than the design this screen draws: 1 at 411 dp or wider, 0.85 at most. */
export function uiScaleFor(width: number): number {
  if (!(width > 0)) return 1;
  return Math.min(1, Math.max(0.85, width / DESIGN_WIDTH));
}

/**
 * The window's width in dp, or 0 where React Native isn't loaded (jest, which
 * checks tokens.ts as plain data); 0 keeps the design's own sizes.
 */
function windowWidth(): number {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Dimensions } = require('react-native') as typeof import('react-native');
    return Dimensions.get('window').width;
  } catch {
    return 0;
  }
}

/** The scale for this run of the app; screens are laid out once, at import. */
export const UiScale = uiScaleFor(windowWidth());

/** A design size in dp at this screen's scale, to the nearest half dp. */
export function scaled(n: number, scale: number = UiScale): number {
  return Math.round(n * scale * 2) / 2;
}

/**
 * The most the phone's text-size setting may enlarge the app's text. Text
 * still grows for people who need it, but the layout keeps its proportions.
 */
export const MaxTextScale = 1.15;
