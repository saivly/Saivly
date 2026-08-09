// ISO 3166-1 alpha-2 codes + English short names. Used for nationality,
// place-of-birth country, and company country dropdowns across
// /onboarding. Stored as the 2-letter code, not the display name.
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "LU", name: "Luxembourg" },
  { code: "AT", name: "Austria" },
  { code: "CH", name: "Switzerland" },
  { code: "ES", name: "Spain" },
  { code: "PT", name: "Portugal" },
  { code: "IT", name: "Italy" },
  { code: "DK", name: "Denmark" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "FI", name: "Finland" },
  { code: "IS", name: "Iceland" },
  { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czechia" },
  { code: "SK", name: "Slovakia" },
  { code: "HU", name: "Hungary" },
  { code: "RO", name: "Romania" },
  { code: "BG", name: "Bulgaria" },
  { code: "GR", name: "Greece" },
  { code: "HR", name: "Croatia" },
  { code: "SI", name: "Slovenia" },
  { code: "EE", name: "Estonia" },
  { code: "LV", name: "Latvia" },
  { code: "LT", name: "Lithuania" },
  { code: "MT", name: "Malta" },
  { code: "CY", name: "Cyprus" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "JP", name: "Japan" },
  { code: "CN", name: "China" },
  { code: "HK", name: "Hong Kong" },
  { code: "SG", name: "Singapore" },
  { code: "KR", name: "South Korea" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "MY", name: "Malaysia" },
  { code: "TH", name: "Thailand" },
  { code: "PH", name: "Philippines" },
  { code: "VN", name: "Vietnam" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "IL", name: "Israel" },
  { code: "TR", name: "Turkey" },
  { code: "EG", name: "Egypt" },
  { code: "ZA", name: "South Africa" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "MA", name: "Morocco" },
  { code: "RU", name: "Russia" },
  { code: "UA", name: "Ukraine" },
  { code: "SR", name: "Suriname" },
  { code: "CW", name: "Curaçao" },
  { code: "AW", name: "Aruba" },
];

export const COUNTRY_CODES = COUNTRIES.map((c) => c.code) as [string, ...string[]];

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

// Renders a 2-letter ISO code as its flag emoji via Unicode regional
// indicator symbols (each letter maps to U+1F1E6.."A" + offset). No image
// assets needed; unsupported code strings just render as-is.
export function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397));
}

// E.164 calling codes for every country above, used to give the phone
// number field a placeholder that matches the shopper's country of
// residence instead of always showing the Dutch example.
const DIAL_CODES: Record<string, string> = {
  NL: "+31",
  BE: "+32",
  DE: "+49",
  FR: "+33",
  GB: "+44",
  IE: "+353",
  LU: "+352",
  AT: "+43",
  CH: "+41",
  ES: "+34",
  PT: "+351",
  IT: "+39",
  DK: "+45",
  SE: "+46",
  NO: "+47",
  FI: "+358",
  IS: "+354",
  PL: "+48",
  CZ: "+420",
  SK: "+421",
  HU: "+36",
  RO: "+40",
  BG: "+359",
  GR: "+30",
  HR: "+385",
  SI: "+386",
  EE: "+372",
  LV: "+371",
  LT: "+370",
  MT: "+356",
  CY: "+357",
  US: "+1",
  CA: "+1",
  MX: "+52",
  BR: "+55",
  AR: "+54",
  CL: "+56",
  CO: "+57",
  AU: "+61",
  NZ: "+64",
  JP: "+81",
  CN: "+86",
  HK: "+852",
  SG: "+65",
  KR: "+82",
  IN: "+91",
  ID: "+62",
  MY: "+60",
  TH: "+66",
  PH: "+63",
  VN: "+84",
  AE: "+971",
  SA: "+966",
  IL: "+972",
  TR: "+90",
  EG: "+20",
  ZA: "+27",
  NG: "+234",
  KE: "+254",
  MA: "+212",
  RU: "+7",
  UA: "+380",
  SR: "+597",
  CW: "+599",
  AW: "+297",
};

export function dialCode(country: string): string {
  return DIAL_CODES[country] ?? "+31";
}

// Realistic example numbers for the three shopper countries; other
// countries fall back to a generic "<dial code> 6 12345678" shape.
const PHONE_PLACEHOLDERS: Record<string, string> = {
  NL: "+31 6 12345678",
  GB: "+44 7911 123456",
  US: "+1 202 555 0123",
};

export function phonePlaceholder(country: string): string {
  return PHONE_PLACEHOLDERS[country] ?? `${dialCode(country)} 6 12345678`;
}
