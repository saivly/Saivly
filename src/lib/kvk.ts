

function kvkConfig(): { apiKey: string; baseUrl: string } {
  const KVK_TEST_BASE_URL = "https://api.kvk.nl/test/api";
  // const KVK_PROD_BASE_URL = "https://api.kvk.nl/api";

  const apiKey: any = process.env.KVK_TEST_API_KEY;
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
  /** KVK's "statutaire naam" — the formal registered name, which can
   * differ from the trade name above. This, not `name`, is what feeds
   * Adyen's organization.legalName (see saveCompanyInfo). */
  statutoryName: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  legalForm: string | null;
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
  statutaireNaam?: string;
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

/** Search Dutch companies by KVK number or trade name. */
export async function searchKvkCompanies(query: string): Promise<KvkSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { apiKey, baseUrl } = kvkConfig();
  const isNumeric = /^\d{8}$/.test(trimmed);
  const params = new URLSearchParams({
    ...(isNumeric ? { kvkNummer: trimmed } : { naam: trimmed }),
    pagina: "1",
    resultatenPerPagina: "5",
  });

  const res = await fetch(`${baseUrl}/v2/zoeken?${params}`, {
    headers: { apikey: apiKey },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`KVK search failed (${res.status})`);
  }

  const data = (await res.json()) as KvkZoekenResponse;
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
    statutoryName: data.statutaireNaam ?? null,
    street: address
      ? [address.straatnaam, address.huisnummer, address.huisnummerToevoeging]
          .filter(Boolean)
          .join(" ")
      : null,
    postalCode: address?.postcode ?? null,
    city: address?.plaats ?? null,
    legalForm: data._embedded?.eigenaar?.rechtsvorm ?? null,
    mainActivity: mainActivity?.sbiOmschrijving ?? null,
  };
}
