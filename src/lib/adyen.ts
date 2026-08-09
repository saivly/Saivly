// Server-only client for Adyen's Legal Entity Management (LEM) API —
// used on /onboarding/personal to register the user as an
// "individual" legal entity once they finish the personal info step.
//
// Docs: https://docs.adyen.com/api-explorer/legalentity/3/post/legalEntities
// Verified against Adyen's published OpenAPI spec (LegalEntityService-v3):
// https://github.com/Adyen/adyen-openapi/blob/main/json/LegalEntityService-v3.json
//
// Auth is a flat `X-API-Key` header. Unlike KVK, Adyen has no public
// key you can borrow for local testing — every key is tied to a real
// Adyen (test or live) account. Set ADYEN_LEGALENTITY_API_KEY once you
// have one; until then this fails soft (see createAdyenIndividual below)
// rather than blocking onboarding on an integration that isn't configured yet.
const ADYEN_TEST_BASE_URL = "https://kyc-test.adyen.com/lem/v3";
const ADYEN_LIVE_BASE_URL = "https://kyc-live.adyen.com/lem/v3";

function adyenConfig(): { apiKey: string; baseUrl: string } | null {
  const apiKey = process.env.ADYEN_LEGALENTITY_API_KEY;
  if (!apiKey || apiKey === "REPLACE_WITH_REAL_ADYEN_API_KEY") return null;
  const baseUrl =
    process.env.ADYEN_LEM_BASE_URL ??
    (process.env.NODE_ENV === "production" ? ADYEN_LIVE_BASE_URL : ADYEN_TEST_BASE_URL);
  return { apiKey, baseUrl };
}

export type AdyenIndividualInput = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string; // YYYY-MM-DD
  residentialAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string; // ISO 3166-1 alpha-2
  };
};

type LegalEntityResponse = { id: string };
type AdyenErrorResponse = { errorCode?: string; message?: string };

/**
 * Creates an "individual" legal entity in Adyen. Returns the created
 * entity's id, or null if ADYEN_LEGALENTITY_API_KEY isn't configured yet
 * or the call fails — callers should treat null as "not registered with
 * Adyen yet", not as a fatal error; onboarding itself doesn't depend on
 * this succeeding.
 */
export async function createAdyenIndividual(
  input: AdyenIndividualInput
): Promise<string | null> {
  const config = adyenConfig();
  if (!config) {
    console.error(
      "[adyen] ADYEN_LEGALENTITY_API_KEY not set (or still the placeholder) — skipping legal entity creation."
    );
    return null;
  }

  try {
    const res = await fetch(`${config.baseUrl}/legalEntities`, {
      method: "POST",
      headers: {
        "X-API-Key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "individual",
        individual: {
          name: {
            firstName: input.firstName,
            lastName: input.lastName,
          },
          birthData: {
            dateOfBirth: input.dateOfBirth,
          },
          residentialAddress: {
            street: input.residentialAddress.street,
            city: input.residentialAddress.city,
            postalCode: input.residentialAddress.postalCode,
            country: input.residentialAddress.country,
          },
          phone: {
            number: input.phoneNumber,
            type: "mobile",
          },
          email: input.email,
        },
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as AdyenErrorResponse | null;
      console.error(
        `[adyen] legalEntities create failed (${res.status}):`,
        body?.message ?? (await res.text().catch(() => "unknown error"))
      );
      return null;
    }

    const data = (await res.json()) as LegalEntityResponse;
    return data.id;
  } catch (err) {
    console.error("[adyen] legalEntities request failed:", err);
    return null;
  }
}
