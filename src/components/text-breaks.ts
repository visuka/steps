import type { ReactNode } from 'react';

const NBSP = ' ';

/**
 * Binds the words that must not part at a line end, so balanced breaking can never
 * strand a number ("3 / home-made"), split a short phrase ("Every / day") or start a
 * line with the separator dot ("Necklace Road / · 17 members"):
 * - a number and the word after it ("3 home-made", "7:10 am", "260 g");
 * - a short unit or time word and the word before it ("Every day", "30 min");
 * - the separator " · " and the word before it, so a line can only break after "· ".
 */
export function keepTogether(text: string): string {
  return text
    .replace(/(\d) (?=\S)/g, `$1${NBSP}`)
    .replace(/ (am|pm|AM|PM|day|min|km|kcal)\b/g, `${NBSP}$1`)
    .replace(/ · /g, `${NBSP}· `);
}

/**
 * The same for a Text's children when they are plain text: a string, or strings and
 * numbers side by side (`{n} steps`), which a Text draws as one run anyway.
 * Anything else (nested Text, elements) is left as it is.
 */
export function keepTogetherChildren(children: ReactNode): ReactNode {
  if (typeof children === 'string') return keepTogether(children);
  if (Array.isArray(children) && children.length > 0 && children.every((c) => typeof c === 'string' || typeof c === 'number')) {
    return keepTogether(children.join(''));
  }
  return children;
}
