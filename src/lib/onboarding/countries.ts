// ISO 3166-1 alpha-2 codes + English short names. Used for nationality,
// place-of-birth country, and company country dropdowns across
// /onboarding. Stored as the 2-letter code, not the display name.
const COUNTRIES_UNSORTED: { code: string; name: string }[] = [
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

// Sorted alphabetically by display name — every dropdown built from this
// (country of residence, nationality, company country) lists countries in
// the order a user would expect to scan, not the source order above.
export const COUNTRIES = [...COUNTRIES_UNSORTED].sort((a, b) =>
  a.name.localeCompare(b.name)
);

export const COUNTRY_CODES = COUNTRIES.map((c) => c.code) as [string, ...string[]];

// Organisations we accept today — kept in sync with provincesForCountry's
// NL/GB/US-only subdivision data (src/lib/provinces.ts) and enforced
// server-side too, via companyCountryCode in src/lib/zod.ts.
export const COMPANY_COUNTRY_CODES = ["NL", "GB", "US"] as const;
export const COMPANY_COUNTRIES = COUNTRIES.filter((c) =>
  (COMPANY_COUNTRY_CODES as readonly string[]).includes(c.code)
);

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

// One currency per supported company country — enough for the annual
// turnover figure that feeds Adyen's businessLine.sourceOfFunds (see
// createAdyenBusinessLine in src/lib/adyen/legalEntity.ts). Falls back to
// EUR for any country outside COMPANY_COUNTRY_CODES.
const COMPANY_COUNTRY_CURRENCIES: Record<string, string> = {
  NL: "EUR",
  GB: "GBP",
  US: "USD",
};

export function companyCountryCurrency(code: string): string {
  return COMPANY_COUNTRY_CURRENCIES[code] ?? "EUR";
}

// Offered on the business-activity step's reserve-fund currency selector
// (see /onboarding/company/business-activity) — defaults to
// companyCountryCurrency(country) but isn't locked to it, since an
// association's reserve fund isn't always denominated in its home
// country's currency. Not exhaustive (ISO 4217 has ~180 codes); covers
// the currencies of every country in COUNTRIES plus a few other major
// ones, sorted alphabetically by code.
const CURRENCIES_UNSORTED: { code: string; name: string }[] = [
  { code: "AED", name: "UAE Dirham" },
  { code: "ARS", name: "Argentine Peso" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "BGN", name: "Bulgarian Lev" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "CLP", name: "Chilean Peso" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "COP", name: "Colombian Peso" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "DKK", name: "Danish Krone" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "HUF", name: "Hungarian Forint" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "ILS", name: "Israeli New Shekel" },
  { code: "INR", name: "Indian Rupee" },
  { code: "ISK", name: "Icelandic Krona" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "KRW", name: "South Korean Won" },
  { code: "MAD", name: "Moroccan Dirham" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "PLN", name: "Polish Zloty" },
  { code: "RON", name: "Romanian Leu" },
  { code: "RUB", name: "Russian Ruble" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "THB", name: "Thai Baht" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "UAH", name: "Ukrainian Hryvnia" },
  { code: "USD", name: "US Dollar" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "ZAR", name: "South African Rand" },
];

export const CURRENCIES = [...CURRENCIES_UNSORTED].sort((a, b) =>
  a.code.localeCompare(b.code)
);

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [
  string,
  ...string[],
];

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
