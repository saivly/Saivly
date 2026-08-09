// Province/state/region tables for the onboarding residential address.
// Only countries with a well-known, stable subdivision scheme get a fixed
// dropdown here (NL, GB, US — the three shopper countries today); every
// other country falls back to a free-text field in personal-form.tsx.
// Codes are kept 2 letters everywhere for consistent storage, e.g. the
// Netherlands' Noord-Holland is stored as "NH".

export type Province = { code: string; name: string };

// ISO 3166-2:NL — the Netherlands' 12 provinces.
const NL_PROVINCES: Province[] = [
  { code: "DR", name: "Drenthe" },
  { code: "FL", name: "Flevoland" },
  { code: "FR", name: "Friesland" },
  { code: "GE", name: "Gelderland" },
  { code: "GR", name: "Groningen" },
  { code: "LI", name: "Limburg" },
  { code: "NB", name: "Noord-Brabant" },
  { code: "NH", name: "Noord-Holland" },
  { code: "OV", name: "Overijssel" },
  { code: "UT", name: "Utrecht" },
  { code: "ZE", name: "Zeeland" },
  { code: "ZH", name: "Zuid-Holland" },
];

// The UK's four constituent countries. Not an official ISO 3166-2:GB code
// (those are 3 letters — ENG/SCT/WLS/NIR); shortened to 2 letters here to
// match every other table in this file and what we store in the database.
const GB_PROVINCES: Province[] = [
  { code: "EN", name: "England" },
  { code: "SC", name: "Scotland" },
  { code: "WA", name: "Wales" },
  { code: "NI", name: "Northern Ireland" },
];

// USPS 2-letter state codes, plus DC and the main inhabited territories.
const US_PROVINCES: Province[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "PR", name: "Puerto Rico" },
  { code: "GU", name: "Guam" },
  { code: "VI", name: "U.S. Virgin Islands" },
  { code: "AS", name: "American Samoa" },
  { code: "MP", name: "Northern Mariana Islands" },
];

export const PROVINCES: Record<string, Province[]> = {
  NL: NL_PROVINCES,
  GB: GB_PROVINCES,
  US: US_PROVINCES,
};

/** Null means the country has no fixed list — render a free-text field. */
export function provincesForCountry(country: string): Province[] | null {
  return PROVINCES[country] ?? null;
}

export function provinceName(country: string, code: string): string {
  return provincesForCountry(country)?.find((p) => p.code === code)?.name ?? code;
}

// Maps PDOK's Dutch `provincienaam` values (see src/lib/pdok.ts) to our NL
// province codes, so the residential address lookup can autofill province
// the same way it already does street + city.
const NL_PROVINCE_NAME_TO_CODE: Record<string, string> = {
  Drenthe: "DR",
  Flevoland: "FL",
  "Fryslân": "FR",
  Friesland: "FR",
  Gelderland: "GE",
  Groningen: "GR",
  Limburg: "LI",
  "Noord-Brabant": "NB",
  "Noord-Holland": "NH",
  Overijssel: "OV",
  Utrecht: "UT",
  Zeeland: "ZE",
  "Zuid-Holland": "ZH",
};

export function nlProvinceCodeFromName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return NL_PROVINCE_NAME_TO_CODE[name];
}
