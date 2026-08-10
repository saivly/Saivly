
import { adyenRequest } from "./client";

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
    stateOrProvince?: string; // 2-letter code, see src/lib/provinces.ts
  };
};

type LegalEntityResponse = { id: string };

export async function createAdyenIndividual(
  input: AdyenIndividualInput
): Promise<string | null> {
  const result = await adyenRequest<LegalEntityResponse>("legalEntity", "/legalEntities", {
    method: "POST",
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
          ...(input.residentialAddress.stateOrProvince
            ? { stateOrProvince: input.residentialAddress.stateOrProvince }
            : {}),
        },
        phone: {
          number: input.phoneNumber,
          type: "mobile",
        },
        email: input.email,
      },
    }),
  });

  console.log(result);

  return result.ok ? result.data.id : null;
}

type OnboardingLinkResponse = { url: string };

/**
 * Adyen-hosted onboarding page for a legal entity — this is where the
 * shopper confirms/uploads identity documents and payout bank details.
 * The returned URL expires after 4 minutes and works once, so call this
 * right before redirecting, never ahead of time / cache it.
 * https://docs.adyen.com/api-explorer/legalentity/latest/post/legalEntities/_id_/onboardingLinks
 */
export async function createAdyenOnboardingLink(
  legalEntityId: string,
  redirectUrl: string
): Promise<string | null> {
  const result = await adyenRequest<OnboardingLinkResponse>(
    "legalEntity",
    `/legalEntities/${legalEntityId}/onboardingLinks`,
    {
      method: "POST",
      body: JSON.stringify({
        redirectUrl,
        settings: {
          // Every legal entity this app creates is an individual (see
          // createAdyenIndividual above) — skip Adyen's own "here's what
          // you're about to do" intro screen since /onboarding/adyen
          // already covers that before the shopper ever leaves our site.
          hideOnboardingIntroductionIndividual: true,
        },
      }),
    }
  );

  return result.ok ? result.data.url : null;
}
