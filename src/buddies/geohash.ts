/**
 * Geohash cells of 5 characters (about 4.9 x 4.9 km), the same code as the
 * server's steps/social/geohash.py. The phone sends only this code for
 * "Walkers in your area" (docs/walk-buddies.md 6.1); never a position.
 */
const ALPHABET = '0123456789bcdefghjkmnpqrstuvwxyz';

export function geohash(lat: number, lon: number, precision = 5): string {
  let latLo = -90;
  let latHi = 90;
  let lonLo = -180;
  let lonHi = 180;
  let bits = 0;
  let even = true;
  let ch = 0;
  let out = '';
  while (out.length < precision) {
    if (even) {
      const mid = (lonLo + lonHi) / 2;
      if (lon >= mid) {
        ch = ch * 2 + 1;
        lonLo = mid;
      } else {
        ch *= 2;
        lonHi = mid;
      }
    } else {
      const mid = (latLo + latHi) / 2;
      if (lat >= mid) {
        ch = ch * 2 + 1;
        latLo = mid;
      } else {
        ch *= 2;
        latHi = mid;
      }
    }
    even = !even;
    bits += 1;
    if (bits === 5) {
      out += ALPHABET[ch];
      bits = 0;
      ch = 0;
    }
  }
  return out;
}
