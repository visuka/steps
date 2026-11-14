import { describe, expect, it } from '@jest/globals';

import {
  COMMON_COUNTRIES,
  COUNTRIES,
  countryChoices,
  countryForZone,
  countryName,
  detectCountry,
  knownCountry,
  requestCountry,
  searchCountries,
} from '@/lib/country';

describe('countryForZone', () => {
  it('maps Indian and neighbouring zones, old names too', () => {
    expect(countryForZone('Asia/Kolkata')).toBe('IN');
    expect(countryForZone('Asia/Calcutta')).toBe('IN');
    expect(countryForZone('Asia/Dhaka')).toBe('BD');
    expect(countryForZone('Asia/Karachi')).toBe('PK');
    expect(countryForZone('Asia/Kathmandu')).toBe('NP');
    expect(countryForZone('Asia/Katmandu')).toBe('NP');
    expect(countryForZone('Asia/Colombo')).toBe('LK');
    expect(countryForZone('Asia/Dubai')).toBe('AE');
    expect(countryForZone('Asia/Saigon')).toBe('VN');
  });

  it('maps zones elsewhere, whole areas and old single names', () => {
    expect(countryForZone('Europe/London')).toBe('GB');
    expect(countryForZone('America/New_York')).toBe('US');
    expect(countryForZone('America/Indiana/Indianapolis')).toBe('US');
    expect(countryForZone('America/Argentina/Salta')).toBe('AR');
    expect(countryForZone('Australia/Sydney')).toBe('AU');
    expect(countryForZone('US/Eastern')).toBe('US');
    expect(countryForZone('US/Samoa')).toBe('AS');
    expect(countryForZone('Canada/Pacific')).toBe('CA');
    expect(countryForZone('Pacific/Auckland')).toBe('NZ');
    expect(countryForZone('Africa/Nairobi')).toBe('KE');
    expect(countryForZone('Japan')).toBe('JP');
    expect(countryForZone('GB')).toBe('GB');
    expect(countryForZone('Europe/Kyiv')).toBe('UA');
  });

  it('has no country for UTC, Antarctica, junk or nothing', () => {
    for (const z of ['UTC', 'Etc/UTC', 'Etc/GMT+5', 'Antarctica/McMurdo', 'Asia/Atlantis', 'Australia/', '', '  ', null, undefined, 5]) {
      expect(countryForZone(z)).toBeNull();
    }
  });

  it('only ever gives codes that are in the country list', () => {
    const zones = ['Asia/Kolkata', 'Europe/Busingen', 'America/Kralendijk', 'Indian/Chagos', 'Pacific/Wake', 'Arctic/Longyearbyen'];
    for (const z of zones) expect(knownCountry(countryForZone(z))).not.toBeNull();
  });
});

describe('the country sent', () => {
  it('goes by the time zone, never the language region', () => {
    // English (UK) on a phone in Hyderabad: the zone says India.
    expect(detectCountry({ timeZone: 'Asia/Kolkata' })).toBe('IN');
    expect(detectCountry({ timeZone: 'Etc/UTC' })).toBeNull();
  });

  it('prefers a SIM or network country when there is one', () => {
    expect(detectCountry({ timeZone: 'Asia/Kolkata', network: 'ae' })).toBe('AE');
    expect(detectCountry({ timeZone: 'Asia/Kolkata', network: '' })).toBe('IN');
    expect(detectCountry({ timeZone: 'Asia/Kolkata', network: 'XX' })).toBe('IN');
  });

  it('lets the Country setting win, and sends none when nothing is known', () => {
    expect(requestCountry('GB', 'IN')).toBe('GB');
    expect(requestCountry(null, 'IN')).toBe('IN');
    expect(requestCountry('UK', 'IN')).toBe('IN');
    expect(requestCountry(null, null)).toBeNull();
  });
});

describe('country list', () => {
  it('names countries and checks codes', () => {
    expect(countryName('IN')).toBe('India');
    expect(countryName('in')).toBe('India');
    expect(countryName('ZZ')).toBeNull();
    expect(knownCountry(' gb ')).toBe('GB');
    expect(knownCountry('419')).toBeNull();
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    expect(COUNTRIES.length).toBeGreaterThan(240);
  });

  it('searches by name start first, then any word, and by code', () => {
    expect(searchCountries('ind')[0].code).toBe('IN');
    expect(searchCountries('ind').map((c) => c.code)).toContain('ID');
    expect(searchCountries('IN')[0].code).toBe('IN');
    expect(searchCountries('korea').map((c) => c.code).sort()).toEqual(['KP', 'KR']);
    expect(searchCountries('reunion').map((c) => c.code)).toEqual(['RE']);
    expect(searchCountries('')).toHaveLength(COUNTRIES.length);
    expect(searchCountries('qqq')).toEqual([]);
    expect(countryName('XK')).toBe('Kosovo');
  });

  it('offers a short list before anything is typed, with the choice and the phone’s country in it', () => {
    const codes = (q: string, chosen: string | null, detected: string | null) => countryChoices(q, chosen, detected).map((c) => c.code);
    expect(codes('', null, 'IN')).toEqual([...COMMON_COUNTRIES]);
    expect(codes('', 'FR', 'JP').slice(0, 2)).toEqual(['FR', 'JP']);
    expect(codes('', 'ZZ', null)).toEqual([...COMMON_COUNTRIES]);
    expect(codes('', null, null).length).toBeLessThan(30);
    expect(codes('kos', null, null)).toEqual(['XK']);
    for (const c of COMMON_COUNTRIES) expect(knownCountry(c)).toBe(c);
  });
});
