
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

// entityAssociations[].type, restricted to the subset valid when the
// *current* legal entity (the one this array lives on) is type
// "organization" — confirmed against the v4 field description: "Possible
// values for organizations: director, signatory, trustOwnership,
// uboThroughOwnership, uboThroughControl, ultimateParentCompany, or
// immediateParentCompany." ultimateParentCompany/immediateParentCompany
// are left out here: those describe the *associated* entity itself being
// a parent company, which can't apply to associatedIndividualLegalEntityId
// — that's always an individual (the shopper), never another
// organization. director/trustOwnership are also excluded, by request —
// only the options below are offered on the company step.
export type AdyenEntityRelationshipType =
  | "signatory"
  | "uboThroughOwnership"
  | "uboThroughControl";

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
  /** The shopper's own individual legal entity (personal step). */
  associatedIndividualLegalEntityId: string;
  /** How that individual relates to the org — collected on the company
   * step ("Your relationship to the company"). Usually one value, but the
   * form also offers "All of the above", which the caller expands into
   * this whole array (see expandRelationshipTypes in ../company/actions.ts)
   * — one entityAssociation gets created per entry, all pointing at the
   * same individual. */
  relationshipTypes: AdyenEntityRelationshipType[];
  /** KVK's RSIN (Dutch tax/legal-entity id, distinct from the KVK
   * registration number) — null outside NL, where there's no RSIN. */
  rsin: string | null;
  /** ISO YYYY-MM-DD, from KVK — null outside NL. */
  dateOfIncorporation: string | null;
};

type OrganizationLegalEntityResponse = { id: string };


export async function createAdyenOrganization(
  input: AdyenOrganizationInput
): Promise<string | null> {
  const organizationType = mapRechtsvormToOrganizationType(input.rechtsvorm);

  const result = await adyenRequest<OrganizationLegalEntityResponse>("legalEntity", "/legalEntities", {
    method: "POST",
    body: JSON.stringify({
      type: "organization",
      organization: {
        legalName: input.legalName,
        doingBusinessAsAbsent: true,
        countryOfGoverningLaw: input.countryOfGoverningLaw,
        registrationNumber: input.registrationNumber || undefined,
        dateOfIncorporation: input.dateOfIncorporation || undefined,
        type: organizationType,
        registeredAddress: {
          street: input.registeredAddress.street,
          city: input.registeredAddress.city,
          postalCode: input.registeredAddress.postalCode,
          country: input.registeredAddress.country,
        },
        // `vatAbsenceReason` (used here for associationIncorporated orgs,
        // which are VAT-exempt by category) doesn't exist on this field in
        // LEM v4 — it was a v1–v3 property, dropped from TaxInformation in
        // v4 (confirmed against the v4 API Explorer schema: country,
        // number, numberAbsent [Australia-only], type — no reason field).
        // Adyen rejects it with a 422 "unknown fields: [vatAbsenceReason]".
        // RSIN is the only tax id v4 actually has a slot for here, so just
        // report it when known and omit taxInformation otherwise — same
        // treatment regardless of organization type.
        ...(input.rsin
          ? {
              taxInformation: [
                { country: input.countryOfGoverningLaw, number: input.rsin },
              ],
            }
          : {}),
      },
      // One association per selected relationship type — jobTitle mirrors
      // that association's own type (see AdyenOrganizationInput above),
      // not a single value shared across all of them.
      entityAssociations: input.relationshipTypes.map((type) => ({
        legalEntityId: input.associatedIndividualLegalEntityId,
        type,
        jobTitle: type,
      })),
    }),
  });

  return result.ok ? result.data.id : null;
}

type OnboardingLinkResponse = { url: string };

/**
 * Adyen-hosted onboarding page for a legal entity — this is where the
 * shopper confirms/uploads identity documents (bank account collection is
 * suppressed for the organisation's account holder — see
 * sendToTransferInstrument in balancePlatform.ts; that capability, not
 * anything in this "settings" object, is what actually controls it).
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
      }),
    }
  );

  return result.ok ? result.data.url : null;
}
