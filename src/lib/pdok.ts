// Server-only client for PDOK Locatieserver — the Dutch government's free,
// keyless address lookup API — used on /onboarding to prefill the
// residential street + city from a postcode + house number instead of
// having the user type them in by hand.
//
// Docs: https://www.pdok.nl/restful-api/-/article/pdok-locatieserver
// No API key or registration needed.

const PDOK_FREE_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";

export type DutchAddress = {
  street: string;
  city: string;
  postalCode: string;
};

type PdokDoc = {
  straatnaam?: string;
  woonplaatsnaam?: string;
  postcode?: string;
  huisnummer?: number;
  huisletter?: string;
  huisnummertoevoeging?: string;
};

type PdokFreeResponse = {
  response?: { numFound: number; docs: PdokDoc[] };
};

/** Look up a Dutch street + city from a postcode and house number. */
export async function lookupDutchAddress(
  postcode: string,
  houseNumber: string
): Promise<DutchAddress | null> {
  const normalizedPostcode = postcode.replace(/\s+/g, "").toUpperCase();
  const normalizedHouseNumber = houseNumber.trim().replace(/[^0-9]/g, "");

  // Bail before hitting the network on obviously-incomplete input — the
  // caller fires this on every blur while the user is still typing.
  if (!/^\d{4}[A-Z]{2}$/.test(normalizedPostcode) || !normalizedHouseNumber) {
    return null;
  }

  const params = new URLSearchParams({
    q: `postcode:${normalizedPostcode} and huisnummer:${normalizedHouseNumber}`,
    fq: "type:adres",
    rows: "1",
  });

  const res = await fetch(`${PDOK_FREE_URL}?${params}`, {
    // Address data barely changes; cache briefly to smooth repeated
    // lookups as a user corrects a digit and blurs the field again.
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`PDOK lookup failed (${res.status})`);
  }

  const data = (await res.json()) as PdokFreeResponse;
  const doc = data.response?.docs?.[0];
  if (!doc?.straatnaam || !doc.woonplaatsnaam) return null;

  const houseNumberFull = [doc.huisnummer, doc.huisletter, doc.huisnummertoevoeging]
    .filter(Boolean)
    .join("");

  return {
    street: [doc.straatnaam, houseNumberFull].filter(Boolean).join(" "),
    city: doc.woonplaatsnaam,
    postalCode: doc.postcode ?? normalizedPostcode,
  };
}
