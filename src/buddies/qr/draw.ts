/**
 * Turning the encoder's modules into what the QR view draws: one SVG path,
 * and a size in whole dp per module (sharp edges). Pure, tested in
 * __tests__/draw.test.ts.
 */

/** The dark modules as one SVG path, a run of dark modules in a row as one rectangle; `offset` is the quiet zone. */
export function modulePath(modules: readonly (readonly boolean[])[], offset: number): string {
  const parts: string[] = [];
  modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      let end = x;
      while (end < row.length && row[end]) end++;
      parts.push(`M${x + offset} ${y + offset}h${end - x}v1h${x - end}z`);
      x = end;
    }
  });
  return parts.join('');
}

/** Modules across with the quiet zone, dp per module (whole, at least 1) and the drawn side in dp, within `side`. */
export function qrLayout(size: number, quiet: number, side: number): { units: number; unit: number; px: number } {
  const units = size + quiet * 2;
  const unit = Math.max(1, Math.floor(side / units));
  return { units, unit, px: unit * units };
}
