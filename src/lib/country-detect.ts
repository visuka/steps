/**
 * The phone's side of the country (lib/country.ts): its time zone, and the
 * Country setting once the profile has loaded. The language region is never
 * read: English (UK) is a language choice, not a place.
 *
 * The SIM or network country would need a new native module (expo-cellular),
 * so for now the time zone stands alone; detectCountry takes it when added.
 */
import { getCalendars } from 'expo-localization';

import { detectCountry, requestCountry } from './country';

let chosen: string | null = null;

/** Kept in step with the profile's Country setting (state/app-state.tsx); null = from the phone. */
export function setChosenCountry(code: string | null): void {
  chosen = code;
}

/** "Asia/Kolkata", or null when the phone won't say. */
export function phoneTimeZone(): string | null {
  try {
    const zone = getCalendars()[0]?.timeZone;
    if (zone) return zone;
  } catch {
    // Fall through to Intl.
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

/** Where the phone seems to be ("IN"), or null. */
export function phoneCountry(): string | null {
  return detectCountry({ timeZone: phoneTimeZone() });
}

/** The country sent with every food request: the setting, else the phone's; null sends none. */
export function foodCountry(): string | null {
  return requestCountry(chosen, phoneCountry());
}
