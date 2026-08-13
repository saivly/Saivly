
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

export type AdyenOrganizationType =
  | "associationIncorporated"
  | "governmentalOrganization"
  | "listedPublicCompany"
  | "nonProfit"
  | "partnershipIncorporated"
  | "privateCompany";

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
export type AdyenEntityRelationshipType =
  | "signatory"
  | "uboThroughOwnership"
  | "uboThroughControl";

export type AdyenOrganizationInput = {
  legalName: string;
  rechtsvorm: string | null;
  registrationNumber: string;
  countryOfGoverningLaw: string;
  registeredAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  associatedIndividualLegalEntityId: string;
  relationshipTypes: AdyenEntityRelationshipType[];
  rsin: string | null;
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
        ...(input.rsin
          ? {
              taxInformation: [
                { country: input.countryOfGoverningLaw, number: input.rsin },
              ],
            }
          : {}),
      },

      entityAssociations: input.relationshipTypes.map((type) => ({
        legalEntityId: input.associatedIndividualLegalEntityId,
        type,
        jobTitle: type,
      })),
    }),
  });

  return result.ok ? result.data.id : null;
}

export type AdyenBusinessLineService = "paymentProcessing" | "banking" | "issuing";

const BUSINESS_LINE_INDUSTRY_CODE = "81399";

type BusinessLineResponse = { id: string };

/**
 * Every organisation on this platform is a homeowners' association (KVK
 * rechtsvorm "vereniging van eigenaars" -> associationIncorporated, see
 * RECHTSVORM_TO_ORGANIZATION_TYPE below) — the money landing in its
 * balance account is always the same story: households' mandatory
 * monthly reserve-fund contributions, saved up for future maintenance
 * and restoration of the shared building. That's true for every org, so
 * it's fixed here rather than collected as free text from each user.
 */
const RESERVE_FUND_SOURCE_OF_FUNDS_DESCRIPTION =
  "Monthly reserve fund contributions paid by the association's homeowners, collected for future maintenance and restoration of the shared building.";

/**
 * Required on banking/issuing business lines whenever the funds landing
 * in the balance account don't come from this platform's own
 * paymentProcessing line — Adyen's sourceOfFunds.type "business" needs
 * both (30_104 "type was not provided" otherwise).
 */
export type AdyenSourceOfFundsBusiness = {
  /** Estimated annual reserve fund contributions, in whole units (not minor units) of `currency`. */
  annualAmount: number;
  /** ISO 4217 currency code, e.g. "EUR". */
  currency: string;
};

export async function createAdyenBusinessLine(
  legalEntityId: string,
  service: AdyenBusinessLineService,
  sourceOfFundsBusiness?: AdyenSourceOfFundsBusiness
): Promise<string | null> {
  const result = await adyenRequest<BusinessLineResponse>("legalEntity", "/businessLines", {
    method: "POST",
    body: JSON.stringify({
      legalEntityId,
      service,
      industryCode: BUSINESS_LINE_INDUSTRY_CODE,
      ...(service === "paymentProcessing"
        ? {
            salesChannels: ["pos", "eCommerce"],
            webData: [{ webAddress: "https://www.saivly.com" }],
          }
        : {
            sourceOfFunds: {
              adyenProcessedFunds: false,
              type: "business",
              description: RESERVE_FUND_SOURCE_OF_FUNDS_DESCRIPTION,
              amount: {
                currency: sourceOfFundsBusiness?.currency,
                // Adyen amounts are minor units (cents for EUR/GBP/USD).
                value: Math.round((sourceOfFundsBusiness?.annualAmount ?? 0) * 100),
              },
            },
          }),
    }),
  });

  return result.ok ? result.data.id : null;
}

type OnboardingLinkResponse = { url: string };

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
