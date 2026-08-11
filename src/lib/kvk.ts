
const KVK_TEST_BASE_URL = "https://api.kvk.nl/test/api";
// const KVK_PROD_BASE_URL = "https://api.kvk.nl/api";

function kvkConfig(): { apiKey: string; baseUrl: string } {
  const apiKey: any = process.env.KVK_API_KEY;
  return { apiKey: apiKey, baseUrl: KVK_TEST_BASE_URL };
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
  /** English where a known Dutch rechtsvorm is recognized (see
   * translateLegalForm below), otherwise the raw KVK value verbatim. */
  legalForm: string | null;
  /** Description of the primary SBI activity (indHoofdactiviteit "Ja"). */
  mainActivity: string | null;
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

type KvkSbiActiviteit = {
  sbiCode: string;
  sbiOmschrijving: string;
  indHoofdactiviteit?: string; // "Ja" | "Nee"
};

type KvkBasisprofielResponse = {
  kvkNummer: string;
  naam: string;
  sbiActiviteiten?: KvkSbiActiviteit[];
  _embedded?: {
    eigenaar?: {
      rechtsvorm?: string;
    };
    hoofdvestiging?: {
      adressen?: {
        type: string;
        straatnaam?: string;
        huisnummer?: number;
        huisnummerToevoeging?: string;
        postcode?: string;
        plaats?: string;
      }[];
      sbiActiviteiten?: KvkSbiActiviteit[];
    };
  };
};

const LEGAL_FORM_TRANSLATIONS: [dutch: string, english: string][] = [
  ["vereniging van eigenaars", "Homeowners' Association (VvE)"],
  ["besloten vennootschap", "Private limited company (B.V.)"],
  ["naamloze vennootschap", "Public limited company (N.V.)"],
  ["vennootschap onder firma", "General partnership (VOF)"],
  ["commanditaire vennootschap", "Limited partnership (CV)"],
  ["onderlinge waarborgmaatschappij", "Mutual insurance association"],
  ["publiekrechtelijke rechtspersoon", "Public-law legal entity"],
  ["kerkgenootschap", "Religious institution"],
  ["eenmanszaak", "Sole proprietorship"],
  ["maatschap", "Partnership (maatschap)"],
  ["coöperatie", "Cooperative"],
  ["stichting", "Foundation"],
  ["vereniging", "Association"],
  ["rederij", "Shipping partnership (rederij)"],
];

export function translateLegalForm(rechtsvorm: string | null | undefined): string | null {
  if (!rechtsvorm) return null;
  const normalized = rechtsvorm.toLowerCase().trim();
  const match = LEGAL_FORM_TRANSLATIONS.find(([dutch]) => normalized.includes(dutch));
  return match ? match[1] : rechtsvorm;
}

/** Search Dutch companies by KVK number or trade name. */
export async function searchKvkCompanies(query: string): Promise<KvkSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { apiKey, baseUrl } = kvkConfig();
  const isNumeric = /^\d{8}$/.test(trimmed);
  const params = new URLSearchParams({
    ...(isNumeric ? { kvkNummer: trimmed } : { naam: trimmed }),
    // A name is ambiguous by nature (that's the whole reason to search
    // instead of typing the KVK number directly) — cap to a handful of
    // candidates the user can actually scan in a dropdown, rather than
    // the API's own default page size.
    pagina: "1",
    resultatenPerPagina: "5",
  });

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
  return results.slice(0, 5);
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

  // sbiActiviteiten is normally at the root; fall back to hoofdvestiging's
  // copy in case a particular profile only populates it there.
  const activities =
    data.sbiActiviteiten ?? data._embedded?.hoofdvestiging?.sbiActiviteiten ?? [];
  const mainActivity =
    activities.find((a) => a.indHoofdactiviteit === "Ja") ?? activities[0];

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
    legalForm: translateLegalForm(data._embedded?.eigenaar?.rechtsvorm),
    mainActivity: mainActivity?.sbiOmschrijving ?? null,
  };
}
