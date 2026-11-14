/**
 * The country food look-ups are worked out for: the person's own choice
 * (You → Settings → Country), else the phone's time zone. Never the
 * language region: English (UK) on a phone in Hyderabad is still India.
 * No React Native here, so jest runs it; country-detect.ts reads the phone.
 */

/**
 * IANA time zones → ISO 3166-1 alpha-2, by area: "Kolkata IN" under Asia is
 * Asia/Kolkata. From tzdata's zone.tab, with the old names phones still
 * report (Asia/Calcutta, Asia/Saigon, US/Eastern). Antarctica and Etc/* have
 * no country.
 */
const ZONES: Record<string, string> = {
  Africa:
    'Abidjan CI Accra GH Addis_Ababa ET Algiers DZ Asmara ER Asmera ER Bamako ML Bangui CF Banjul GM Bissau GW Blantyre MW ' +
    'Brazzaville CG Bujumbura BI Cairo EG Casablanca MA Ceuta ES Conakry GN Dakar SN Dar_es_Salaam TZ Djibouti DJ Douala CM ' +
    'El_Aaiun EH Freetown SL Gaborone BW Harare ZW Johannesburg ZA Juba SS Kampala UG Khartoum SD Kigali RW Kinshasa CD ' +
    'Lagos NG Libreville GA Lome TG Luanda AO Lubumbashi CD Lusaka ZM Malabo GQ Maputo MZ Maseru LS Mbabane SZ Mogadishu SO ' +
    'Monrovia LR Nairobi KE Ndjamena TD Niamey NE Nouakchott MR Ouagadougou BF Porto-Novo BJ Sao_Tome ST Timbuktu ML ' +
    'Tripoli LY Tunis TN Windhoek NA',
  America:
    'Adak US Anchorage US Anguilla AI Antigua AG Araguaina BR Buenos_Aires AR Catamarca AR Cordoba AR Jujuy AR Mendoza AR ' +
    'Rosario AR Aruba AW Asuncion PY Atikokan CA Atka US Bahia BR Bahia_Banderas MX Barbados BB Belem BR Belize BZ ' +
    'Blanc-Sablon CA Boa_Vista BR Bogota CO Boise US Cambridge_Bay CA Campo_Grande BR Cancun MX Caracas VE Cayenne GF ' +
    'Cayman KY Chicago US Chihuahua MX Ciudad_Juarez MX Coral_Harbour CA Costa_Rica CR Creston CA Cuiaba BR Curacao CW ' +
    'Danmarkshavn GL Dawson CA Dawson_Creek CA Denver US Detroit US Dominica DM Edmonton CA Eirunepe BR El_Salvador SV ' +
    'Ensenada MX Fort_Nelson CA Fort_Wayne US Fortaleza BR Glace_Bay CA Godthab GL Goose_Bay CA Grand_Turk TC Grenada GD ' +
    'Guadeloupe GP Guatemala GT Guayaquil EC Guyana GY Halifax CA Havana CU Hermosillo MX Indianapolis US Inuvik CA ' +
    'Iqaluit CA Jamaica JM Juneau US Knox_IN US Kralendijk BQ La_Paz BO Lima PE Los_Angeles US Louisville US ' +
    'Lower_Princes SX Maceio BR Managua NI Manaus BR Marigot MF Martinique MQ Matamoros MX Mazatlan MX Menominee US ' +
    'Merida MX Metlakatla US Mexico_City MX Miquelon PM Moncton CA Monterrey MX Montevideo UY Montreal CA Montserrat MS ' +
    'Nassau BS New_York US Nipigon CA Nome US Noronha BR Nuuk GL Ojinaga MX Panama PA Pangnirtung CA Paramaribo SR ' +
    'Phoenix US Port-au-Prince HT Port_of_Spain TT Porto_Acre BR Porto_Velho BR Puerto_Rico PR Punta_Arenas CL ' +
    'Rainy_River CA Rankin_Inlet CA Recife BR Regina CA Resolute CA Rio_Branco BR Santa_Isabel MX Santarem BR Santiago CL ' +
    'Santo_Domingo DO Sao_Paulo BR Scoresbysund GL Shiprock US Sitka US St_Barthelemy BL St_Johns CA St_Kitts KN ' +
    'St_Lucia LC St_Thomas VI St_Vincent VC Swift_Current CA Tegucigalpa HN Thule GL Thunder_Bay CA Tijuana MX Toronto CA ' +
    'Tortola VG Vancouver CA Virgin VI Whitehorse CA Winnipeg CA Yakutat US Yellowknife CA',
  Arctic: 'Longyearbyen SJ',
  Asia:
    'Aden YE Almaty KZ Amman JO Anadyr RU Aqtau KZ Aqtobe KZ Ashgabat TM Ashkhabad TM Atyrau KZ Baghdad IQ Bahrain BH ' +
    'Baku AZ Bangkok TH Barnaul RU Beirut LB Bishkek KG Brunei BN Calcutta IN Chita RU Choibalsan MN Chongqing CN ' +
    'Chungking CN Colombo LK Dacca BD Damascus SY Dhaka BD Dili TL Dubai AE Dushanbe TJ Famagusta CY Gaza PS Harbin CN ' +
    'Hebron PS Ho_Chi_Minh VN Hong_Kong HK Hovd MN Irkutsk RU Istanbul TR Jakarta ID Jayapura ID Jerusalem IL Kabul AF ' +
    'Kamchatka RU Karachi PK Kashgar CN Kathmandu NP Katmandu NP Khandyga RU Kolkata IN Krasnoyarsk RU Kuala_Lumpur MY ' +
    'Kuching MY Kuwait KW Macao MO Macau MO Magadan RU Makassar ID Manila PH Muscat OM Nicosia CY Novokuznetsk RU ' +
    'Novosibirsk RU Omsk RU Oral KZ Phnom_Penh KH Pontianak ID Pyongyang KP Qatar QA Qostanay KZ Qyzylorda KZ Rangoon MM ' +
    'Riyadh SA Saigon VN Sakhalin RU Samarkand UZ Seoul KR Shanghai CN Singapore SG Srednekolymsk RU Taipei TW Tashkent UZ ' +
    'Tbilisi GE Tehran IR Tel_Aviv IL Thimbu BT Thimphu BT Tokyo JP Tomsk RU Ujung_Pandang ID Ulaanbaatar MN Ulan_Bator MN ' +
    'Urumqi CN Ust-Nera RU Vientiane LA Vladivostok RU Yakutsk RU Yangon MM Yekaterinburg RU Yerevan AM',
  Atlantic:
    'Azores PT Bermuda BM Canary ES Cape_Verde CV Faeroe FO Faroe FO Jan_Mayen SJ Madeira PT Reykjavik IS South_Georgia GS ' +
    'St_Helena SH Stanley FK',
  Europe:
    'Amsterdam NL Andorra AD Astrakhan RU Athens GR Belfast GB Belgrade RS Berlin DE Bratislava SK Brussels BE Bucharest RO ' +
    'Budapest HU Busingen DE Chisinau MD Copenhagen DK Dublin IE Gibraltar GI Guernsey GG Helsinki FI Isle_of_Man IM ' +
    'Istanbul TR Jersey JE Kaliningrad RU Kiev UA Kirov RU Kyiv UA Lisbon PT Ljubljana SI London GB Luxembourg LU Madrid ES ' +
    'Malta MT Mariehamn AX Minsk BY Monaco MC Moscow RU Nicosia CY Oslo NO Paris FR Podgorica ME Prague CZ Riga LV Rome IT ' +
    'Samara RU San_Marino SM Sarajevo BA Saratov RU Simferopol UA Skopje MK Sofia BG Stockholm SE Tallinn EE Tirane AL ' +
    'Tiraspol MD Ulyanovsk RU Uzhgorod UA Vaduz LI Vatican VA Vienna AT Vilnius LT Volgograd RU Warsaw PL Zagreb HR ' +
    'Zaporozhye UA Zurich CH',
  Indian:
    'Antananarivo MG Chagos IO Christmas CX Cocos CC Comoro KM Kerguelen TF Mahe SC Maldives MV Mauritius MU Mayotte YT ' +
    'Reunion RE',
  Pacific:
    'Apia WS Auckland NZ Bougainville PG Chatham NZ Chuuk FM Easter CL Efate VU Enderbury KI Fakaofo TK Fiji FJ Funafuti TV ' +
    'Galapagos EC Gambier PF Guadalcanal SB Guam GU Honolulu US Johnston UM Kanton KI Kiritimati KI Kosrae FM Kwajalein MH ' +
    'Majuro MH Marquesas PF Midway UM Nauru NR Niue NU Norfolk NF Noumea NC Pago_Pago AS Palau PW Pitcairn PN Pohnpei FM ' +
    'Ponape FM Port_Moresby PG Rarotonga CK Saipan MP Samoa AS Tahiti PF Tarawa KI Tongatapu TO Truk FM Wake UM Wallis WF ' +
    'Yap FM',
  // Old single names ("GB", "Japan").
  '':
    'Cuba CU Egypt EG Eire IE GB GB GB-Eire GB Hongkong HK Iceland IS Iran IR Israel IL Jamaica JM Japan JP Kwajalein MH ' +
    'Libya LY NZ NZ NZ-CHAT NZ Navajo US PRC CN Poland PL Portugal PT ROC TW ROK KR Singapore SG Turkey TR W-SU RU',
};

/** Areas whose every zone is one country: "Australia/Perth", "America/Argentina/Salta", "US/Eastern". */
const WHOLE_AREAS: [string, string][] = [
  ['Australia/', 'AU'],
  ['America/Argentina/', 'AR'],
  ['America/Indiana/', 'US'],
  ['America/Kentucky/', 'US'],
  ['America/North_Dakota/', 'US'],
  ['US/', 'US'],
  ['Canada/', 'CA'],
  ['Brazil/', 'BR'],
  ['Mexico/', 'MX'],
  ['Chile/', 'CL'],
];

let zoneMap: Map<string, string> | null = null;

function zones(): Map<string, string> {
  if (zoneMap) return zoneMap;
  const map = new Map<string, string>();
  for (const [area, list] of Object.entries(ZONES)) {
    const parts = list.split(' ');
    for (let i = 0; i + 1 < parts.length; i += 2) map.set(area ? `${area}/${parts[i]}` : parts[i], parts[i + 1]);
  }
  // US/Samoa is American Samoa, not the US.
  map.set('US/Samoa', 'AS');
  zoneMap = map;
  return map;
}

/** "Asia/Kolkata" → "IN"; null for zones with no country (UTC, Antarctica) or anything unknown. */
export function countryForZone(zone: unknown): string | null {
  if (typeof zone !== 'string') return null;
  const z = zone.trim();
  if (!z) return null;
  const exact = zones().get(z);
  if (exact) return exact;
  for (const [prefix, code] of WHOLE_AREAS) if (z.startsWith(prefix) && z.length > prefix.length) return code;
  return null;
}

/** ISO 3166-1 alpha-2 codes with English names, for the Country setting. */
const NAMES =
  'AD Andorra|AE United Arab Emirates|AF Afghanistan|AG Antigua and Barbuda|AI Anguilla|AL Albania|AM Armenia|AO Angola|' +
  'AR Argentina|AS American Samoa|AT Austria|AU Australia|AW Aruba|AX Åland Islands|AZ Azerbaijan|BA Bosnia and Herzegovina|' +
  'BB Barbados|BD Bangladesh|BE Belgium|BF Burkina Faso|BG Bulgaria|BH Bahrain|BI Burundi|BJ Benin|BL Saint Barthélemy|' +
  'BM Bermuda|BN Brunei|BO Bolivia|BQ Caribbean Netherlands|BR Brazil|BS Bahamas|BT Bhutan|BW Botswana|BY Belarus|BZ Belize|' +
  'CA Canada|CC Cocos (Keeling) Islands|CD Congo (DRC)|CF Central African Republic|CG Congo|CH Switzerland|CI Côte d’Ivoire|' +
  'CK Cook Islands|CL Chile|CM Cameroon|CN China|CO Colombia|CR Costa Rica|CU Cuba|CV Cape Verde|CW Curaçao|' +
  'CX Christmas Island|CY Cyprus|CZ Czechia|DE Germany|DJ Djibouti|DK Denmark|DM Dominica|DO Dominican Republic|DZ Algeria|' +
  'EC Ecuador|EE Estonia|EG Egypt|EH Western Sahara|ER Eritrea|ES Spain|ET Ethiopia|FI Finland|FJ Fiji|FK Falkland Islands|' +
  'FM Micronesia|FO Faroe Islands|FR France|GA Gabon|GB United Kingdom|GD Grenada|GE Georgia|GF French Guiana|GG Guernsey|' +
  'GH Ghana|GI Gibraltar|GL Greenland|GM Gambia|GN Guinea|GP Guadeloupe|GQ Equatorial Guinea|GR Greece|' +
  'GS South Georgia and the South Sandwich Islands|GT Guatemala|GU Guam|GW Guinea-Bissau|GY Guyana|HK Hong Kong|HN Honduras|' +
  'HR Croatia|HT Haiti|HU Hungary|ID Indonesia|IE Ireland|IL Israel|IM Isle of Man|IN India|IO British Indian Ocean Territory|' +
  'IQ Iraq|IR Iran|IS Iceland|IT Italy|JE Jersey|JM Jamaica|JO Jordan|JP Japan|KE Kenya|KG Kyrgyzstan|KH Cambodia|KI Kiribati|' +
  'KM Comoros|KN Saint Kitts and Nevis|KP North Korea|KR South Korea|KW Kuwait|KY Cayman Islands|KZ Kazakhstan|LA Laos|' +
  'LB Lebanon|LC Saint Lucia|LI Liechtenstein|LK Sri Lanka|LR Liberia|LS Lesotho|LT Lithuania|LU Luxembourg|LV Latvia|' +
  'LY Libya|MA Morocco|MC Monaco|MD Moldova|ME Montenegro|MF Saint Martin|MG Madagascar|MH Marshall Islands|MK North Macedonia|' +
  'ML Mali|MM Myanmar|MN Mongolia|MO Macao|MP Northern Mariana Islands|MQ Martinique|MR Mauritania|MS Montserrat|MT Malta|' +
  'MU Mauritius|MV Maldives|MW Malawi|MX Mexico|MY Malaysia|MZ Mozambique|NA Namibia|NC New Caledonia|NE Niger|' +
  'NF Norfolk Island|NG Nigeria|NI Nicaragua|NL Netherlands|NO Norway|NP Nepal|NR Nauru|NU Niue|NZ New Zealand|OM Oman|' +
  'PA Panama|PE Peru|PF French Polynesia|PG Papua New Guinea|PH Philippines|PK Pakistan|PL Poland|PM Saint Pierre and Miquelon|' +
  'PN Pitcairn Islands|PR Puerto Rico|PS Palestine|PT Portugal|PW Palau|PY Paraguay|QA Qatar|RE Réunion|RO Romania|RS Serbia|' +
  'RU Russia|RW Rwanda|SA Saudi Arabia|SB Solomon Islands|SC Seychelles|SD Sudan|SE Sweden|SG Singapore|SH Saint Helena|' +
  'SI Slovenia|SJ Svalbard and Jan Mayen|SK Slovakia|SL Sierra Leone|SM San Marino|SN Senegal|SO Somalia|SR Suriname|' +
  'SS South Sudan|ST São Tomé and Príncipe|SV El Salvador|SX Sint Maarten|SY Syria|SZ Eswatini|TC Turks and Caicos Islands|' +
  'TD Chad|TF French Southern Territories|TG Togo|TH Thailand|TJ Tajikistan|TK Tokelau|TL Timor-Leste|TM Turkmenistan|' +
  'TN Tunisia|TO Tonga|TR Türkiye|TT Trinidad and Tobago|TV Tuvalu|TW Taiwan|TZ Tanzania|UA Ukraine|UG Uganda|' +
  'UM U.S. Outlying Islands|US United States|UY Uruguay|UZ Uzbekistan|VA Vatican City|VC Saint Vincent and the Grenadines|' +
  'VE Venezuela|VG British Virgin Islands|VI U.S. Virgin Islands|VN Vietnam|VU Vanuatu|WF Wallis and Futuna|WS Samoa|XK Kosovo|' +
  'YE Yemen|YT Mayotte|ZA South Africa|ZM Zambia|ZW Zimbabwe';

export interface Country {
  code: string;
  name: string;
}

/** Every country, by name. */
export const COUNTRIES: readonly Country[] = NAMES.split('|')
  .map((entry) => ({ code: entry.slice(0, 2), name: entry.slice(3) }))
  .sort((a, b) => a.name.localeCompare(b.name));

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** "IN" → "India"; null for a code that isn't a country. */
export function countryName(code: string | null | undefined): string | null {
  return code ? (BY_CODE.get(code.toUpperCase())?.name ?? null) : null;
}

/** An upper-case code from the list, or null. "in" → "IN"; "UK", "419" → null. */
export function knownCountry(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const c = code.trim().toUpperCase();
  return BY_CODE.has(c) ? c : null;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Countries matching what was typed: the code exactly, or a word of the name starting with it. Names starting with it first. */
export function searchCountries(query: string, list: readonly Country[] = COUNTRIES): Country[] {
  const q = fold(query);
  if (!q) return [...list];
  const starts: Country[] = [];
  const words: Country[] = [];
  for (const c of list) {
    const name = fold(c.name);
    if (c.code.toLowerCase() === q || name.startsWith(q)) starts.push(c);
    else if (name.split(' ').some((w) => w.startsWith(q))) words.push(c);
  }
  return [...starts, ...words];
}

/** Shown before anything is typed: where most people using the app live. Codes from the list. */
export const COMMON_COUNTRIES: readonly string[] = [
  'IN', 'US', 'GB', 'AE', 'SA', 'QA', 'KW', 'OM', 'BH', 'SG', 'MY', 'CA', 'AU', 'NZ', 'BD', 'LK', 'NP', 'PK', 'DE', 'IE',
];

/**
 * The rows of the Country sheet. Typed: every match. Nothing typed: a short
 * list (the common countries, plus the saved choice and the phone's country
 * when they aren't among them), so the sheet never draws 250 rows at once.
 */
export function countryChoices(query: string, chosen: string | null, detected: string | null): Country[] {
  if (fold(query)) return searchCountries(query);
  const codes = [...COMMON_COUNTRIES];
  for (const c of [detected, chosen]) {
    const k = knownCountry(c);
    if (k && !codes.includes(k)) codes.unshift(k);
  }
  return codes.map((c) => BY_CODE.get(c)).filter((c): c is Country => c !== undefined);
}

/**
 * Where the phone is, as far as the app can tell without asking: the SIM or
 * network country when the phone gives one, else the time zone. Each is
 * checked; anything unknown is skipped.
 */
export function detectCountry(signals: { timeZone?: unknown; network?: unknown }): string | null {
  return knownCountry(signals.network) ?? knownCountry(countryForZone(signals.timeZone));
}

/** The country food requests go with: the person's choice, else what the phone says, else none (the server assumes India). */
export function requestCountry(chosen: unknown, detected: unknown): string | null {
  return knownCountry(chosen) ?? knownCountry(detected);
}
