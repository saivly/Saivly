// Server-only client for the Dutch Chamber of Commerce (KVK) API —
// used on the /onboarding company step to look up a Dutch business
// by KVK number or trade name instead of having the user type it in by hand.
//
// Docs: https://developers.kvk.nl/documentation
//
// Auth is a flat `apikey` header, no OAuth/certificate needed.
//   - Production: set KVK_API_KEY (request one at developers.kvk.nl —
//     "aanvragen" an API key, free for the Zoeken + Basisprofiel APIs).
//   - Local dev: if KVK_API_KEY is unset outside production, this module
//     falls back to KVK's own published test key against their sandbox
//     (fixed fictional dataset — e.g. KVK number 68750110 returns "Test BV
//     Donald"). That fallback is intentionally disabled once
//     NODE_ENV=production so a forgotten env var fails loudly instead of
//     quietly serving fake companies.
const KVK_TEST_API_KEY = "l7xx1f2691f2520d487b902f4e0b57a0b197";
const KVK_TEST_BASE_URL = "https://api.kvk.nl/test/api";
const KVK_PROD_BASE_URL = "https://api.kvk.nl/api";

function kvkConfig(): { apiKey: string; baseUrl: string } {
  const apiKey = process.env.KVK_API_KEY;
  if (apiKey) {
    return { apiKey, baseUrl: process.env.KVK_API_BASE_URL ?? KVK_PROD_BASE_URL };
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "KVK_API_KEY is not set. Request a key at https://developers.kvk.nl and add it to your production environment."
    );
  }
  return { apiKey: KVK_TEST_API_KEY, baseUrl: KVK_TEST_BASE_URL };
}

export type KvkSearchResult = {
  kvkNumber: string;
  name: string;
  city: string | null;
  type: string;
};

export type KvkCompanyDetails = {
  kvkNumber: string;
  name: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
};

type KvkZoekenResponse = {
  resultaten?: {
    kvkNummer: string;
    naam: string;
    type: string;
    adres?: {
      binnenlandsAdres?: { plaats?: string };
      buitenlandsAdres?: { plaats?: string };
    };
  }[];
};

type KvkBasisprofielResponse = {
  kvkNummer: string;
  naam: string;
  _embedded?: {
    hoofdvestiging?: {
      adressen?: {
        type: string;
        straatnaam?: string;
        huisnummer?: number;
        huisnummerToevoeging?: string;
        postcode?: string;
        plaats?: string;
      }[];
    };
  };
};

/** Search Dutch companies by KVK number or trade name. */
export async function searchKvkCompanies(query: string): Promise<KvkSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { apiKey, baseUrl } = kvkConfig();
  const isNumeric = /^\d{8}$/.test(trimmed);
  const params = new URLSearchParams(
    isNumeric ? { kvkNummer: trimmed } : { naam: trimmed }
  );

  const res = await fetch(`${baseUrl}/v2/zoeken?${params}`, {
    headers: { apikey: apiKey },
    // Search results change rarely enough that a short cache is fine, and
    // meaningfully cuts latency when a user re-types/corrects a query.
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`KVK search failed (${res.status})`);
  }

  const data = (await res.json()) as KvkZoekenResponse;
  // Dedupe by kvkNummer — a search can return multiple vestigingen
  // (branches) per company; we only need one entry to pick from.
  const seen = new Set<string>();
  const results: KvkSearchResult[] = [];
  for (const r of data.resultaten ?? []) {
    if (seen.has(r.kvkNummer)) continue;
    seen.add(r.kvkNummer);
    results.push({
      kvkNumber: r.kvkNummer,
      name: r.naam,
      city:
        r.adres?.binnenlandsAdres?.plaats ??
        r.adres?.buitenlandsAdres?.plaats ??
        null,
      type: r.type,
    });
  }
  return results.slice(0, 10);
}

/** Fetch full details (name + address) for one company, by KVK number. */
export async function getKvkCompanyDetails(
  kvkNumber: string
): Promise<KvkCompanyDetails | null> {
  if (!/^\d{8}$/.test(kvkNumber)) return null;

  const { apiKey, baseUrl } = kvkConfig();
  const res = await fetch(`${baseUrl}/v1/basisprofielen/${kvkNumber}`, {
    headers: { apikey: apiKey },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`KVK lookup failed (${res.status})`);
  }

  const data = (await res.json()) as KvkBasisprofielResponse;
  const addresses = data._embedded?.hoofdvestiging?.adressen ?? [];
  const address =
    addresses.find((a) => a.type === "bezoekadres") ?? addresses[0];

  return {
    kvkNumber: data.kvkNummer,
    name: data.naam,
    street: address
      ? [address.straatnaam, address.huisnummer, address.huisnummerToevoeging]
          .filter(Boolean)
          .join(" ")
      : null,
    postalCode: address?.postcode ?? null,
    city: address?.plaats ?? null,
  };
}
