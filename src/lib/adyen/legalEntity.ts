
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

  return result.ok ? result.data.id : null;
}

// Adyen's organization.type enum (Legal Entity Management v4) — distinct
// from KvkCompanyDetails.legalForm, which stays the raw Dutch KVK
// "rechtsvorm" for display (src/lib/kvk.ts). This is a separate,
// Adyen-specific classification with only 6 possible values, so a KVK
// rechtsvorm has to be squeezed into the closest one.
export type AdyenOrganizationType =
  | "associationIncorporated"
  | "governmentalOrganization"
  | "listedPublicCompany"
  | "nonProfit"
  | "partnershipIncorporated"
  | "privateCompany";

// Ordered so multi-word, more specific Dutch terms are matched before a
// generic term they contain — same reasoning as the (now-removed) display
// translator this replaces. privateCompany is the fallback for anything
// unrecognized (BV/eenmanszaak-shaped things), since it's the most common
// case in the KVK register.
const RECHTSVORM_TO_ORGANIZATION_TYPE: [dutch: string, type: AdyenOrganizationType][] = [
  ["vereniging van eigenaars", "associationIncorporated"],
  ["publiekrechtelijke rechtspersoon", "governmentalOrganization"],
  ["kerkgenootschap", "nonProfit"],
  ["stichting", "nonProfit"],
  ["onderlinge waarborgmaatschappij", "associationIncorporated"],
  ["coöperatie", "associationIncorporated"],
  ["vereniging", "associationIncorporated"],
  ["vennootschap onder firma", "partnershipIncorporated"],
  ["commanditaire vennootschap", "partnershipIncorporated"],
  ["maatschap", "partnershipIncorporated"],
  ["rederij", "partnershipIncorporated"],
  // Naamloze vennootschap (NV) structurally maps to a public company, but
  // "listedPublicCompany" is specifically for exchange-listed ones — KVK's
  // rechtsvorm alone doesn't say whether that's the case, and most NVs
  // in the register aren't, so treat it like any other private company.
  ["naamloze vennootschap", "privateCompany"],
  ["besloten vennootschap", "privateCompany"],
  ["eenmanszaak", "privateCompany"],
];

export function mapRechtsvormToOrganizationType(
  rechtsvorm: string | null | undefined
): AdyenOrganizationType {
  const normalized = (rechtsvorm ?? "").toLowerCase().trim();
  const match = RECHTSVORM_TO_ORGANIZATION_TYPE.find(([dutch]) => normalized.includes(dutch));
  return match ? match[1] : "privateCompany";
}

export type AdyenOrganizationInput = {
  legalName: string; // KVK statutaireNaam, or the manually-entered company name outside NL
  rechtsvorm: string | null; // raw KVK rechtsvorm — null outside NL, mapped above
  registrationNumber: string; // KVK number, or "" outside NL
  countryOfGoverningLaw: string; // ISO 3166-1 alpha-2
  registeredAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string; // ISO 3166-1 alpha-2
  };
  /** The shopper's own individual legal entity (personal step) — linked
   * as both signatory and UBO-through-ownership. */
  associatedIndividualLegalEntityId: string;
};

type OrganizationLegalEntityResponse = { id: string };

/**
 * The organisation's own legal entity — separate from the individual one
 * createAdyenIndividual makes for the shopper themself. Used for KYB
 * (business) verification + as the anchor for the account holder/balance
 * account below.
 * https://docs.adyen.com/api-explorer/legalentity/latest/post/legalEntities
 */
export async function createAdyenOrganization(
  input: AdyenOrganizationInput
): Promise<string | null> {
  const result = await adyenRequest<OrganizationLegalEntityResponse>("legalEntity", "/legalEntities", {
    method: "POST",
    body: JSON.stringify({
      type: "organization",
      organization: {
        legalName: input.legalName,
        countryOfGoverningLaw: input.countryOfGoverningLaw,
        registrationNumber: input.registrationNumber || undefined,
        type: mapRechtsvormToOrganizationType(input.rechtsvorm),
        registeredAddress: {
          street: input.registeredAddress.street,
          city: input.registeredAddress.city,
          postalCode: input.registeredAddress.postalCode,
          country: input.registeredAddress.country,
        },
      },
      entityAssociations: [
        { legalEntityId: input.associatedIndividualLegalEntityId, type: "signatory" },
        { legalEntityId: input.associatedIndividualLegalEntityId, type: "uboThroughOwnership" },
      ],
    }),
  });

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
          // This app creates both individual (personal step) and
          // organization (company step, see createAdyenOrganization below)
          // legal entities — skip Adyen's own "here's what you're about to
          // do" intro either way, since /onboarding/adyen already covers
          // that before the shopper ever leaves our site.
          // hideOnboardingIntroductionIndividual: true,
          // hideOnboardingIntroductionOrganization: true,
        },
      }),
    }
  );

  return result.ok ? result.data.url : null;
}
