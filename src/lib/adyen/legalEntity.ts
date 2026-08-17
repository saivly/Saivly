
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

const HOMEOWNERS_ASSOCIATION_RECHTSVORM = "vereniging van eigenaars";

/**
 * Narrower than organizationType === "associationIncorporated" — that
 * bucket also catches "vereniging", "coöperatie", and "onderlinge
 * waarborgmaatschappij", none of which get the homeowners'-association-
 * specific treatment below (fixed industry code, VAT exemption, no
 * website, fixed source-of-funds description). Only KVK rechtsvorm
 * "vereniging van eigenaars" (VvE) does.
 */
export function isHomeownersAssociation(rechtsvorm: string | null | undefined): boolean {
  return (rechtsvorm ?? "").toLowerCase().trim().includes(HOMEOWNERS_ASSOCIATION_RECHTSVORM);
}

/**
 * Fixed industry code for VvEs on every business line — see
 * src/lib/onboarding/industry-codes.ts ("53 Real Estate and Rental and
 * Leasing" / "Activities Related to Real Estate"). Locked server-side
 * (not just disabled in the business-activity form) so it can't be
 * overridden by tampering with the request.
 */
export const HOMEOWNERS_ASSOCIATION_INDUSTRY_CODE = "5313";

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
  annualReserveFundContributions: number;
  /** ISO 4217 currency code the reserve-fund figure above is denominated
   * in — picked by the shopper on the business-activity screen, not
   * assumed from countryOfGoverningLaw. */
  reserveFundCurrency: string;
  /** Support contact shown to Adyen (and, downstream, to cardholders) —
   * collected on the contact-details screen, after industryCode. */
  supportEmail: string;
  supportPhone: string;
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
      // Top-level, not nested under `organization` — required once a
      // platform is involved. phone.type is fixed to "mobile" rather
      // than asked on the form, same as the individual's phone above.
      support: {
        email: input.supportEmail,
        phone: {
          number: input.supportPhone,
          phoneCountryCode: input.registeredAddress.country,
          type: "mobile",
        },
      },
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
        financialReports: [
          {
            annualTurnover: input.annualReserveFundContributions,
            currencyOfFinancialData: input.reserveFundCurrency,
            dateOfFinancialData: new Date().toISOString().slice(0, 10),
          },
        ],
        ...(input.rsin
          ? {
              taxInformation: [
                { country: input.countryOfGoverningLaw, number: input.rsin },
              ],
            }
          : {}),
        ...(isHomeownersAssociation(input.rechtsvorm)
          ? {
              taxReportingClassification: {
                businessType: "other",
                mainSourceOfIncome: "businessOperation",
                type: "nonFinancialPassive",
              },
              vatAbsenceReason: "industryExemption",
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

type BusinessLineResponse = { id: string };

/**
 * Most organisations on this platform are homeowners' associations (KVK
 * rechtsvorm "vereniging van eigenaars", see isHomeownersAssociation
 * above) — for those, the money landing in the balance account is always
 * the same story: households' mandatory reserve-fund contributions,
 * saved up for future maintenance and restoration of the shared
 * building. That's fixed rather than collected as free text for VvEs
 * specifically; every other org falls back to a generic description
 * below rather than assuming that story applies to it too.
 */
const RESERVE_FUND_SOURCE_OF_FUNDS_DESCRIPTION =
  "Monthly reserve fund contributions paid by the association's homeowners, collected for future maintenance and restoration of the shared building.";

const GENERIC_SOURCE_OF_FUNDS_DESCRIPTION =
  "Revenue generated by the organisation's normal business activities.";

export function sourceOfFundsDescription(rechtsvorm: string | null | undefined): string {
  return isHomeownersAssociation(rechtsvorm)
    ? RESERVE_FUND_SOURCE_OF_FUNDS_DESCRIPTION
    : GENERIC_SOURCE_OF_FUNDS_DESCRIPTION;
}

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
  /** See sourceOfFundsDescription above — picked from the org's Adyen organizationType, not user-entered. */
  description: string;
};

export async function createAdyenBusinessLine(
  legalEntityId: string,
  service: AdyenBusinessLineService,
  /** One of Adyen's own industry codes — see src/lib/onboarding/industry-codes.ts.
   * Picked by the shopper on the business-activity screen, same code across
   * all three business lines for a given org. */
  industryCode: string,
  /** Company website, from the contact-details screen — null/empty
   * exempts webAddress instead (most orgs here don't have one). */
  website: string | null,
  sourceOfFundsBusiness?: AdyenSourceOfFundsBusiness
): Promise<string | null> {
  const result = await adyenRequest<BusinessLineResponse>("legalEntity", "/businessLines", {
    method: "POST",
    body: JSON.stringify({
      legalEntityId,
      service,
      industryCode,
      ...(website
        ? { webAddress: website }
        : // No storefront/app to point Adyen at — exempted rather than
          // pointing Adyen at saivly.com itself, which isn't the
          // shopper's business.
          { webDataExemption: { reason: "noOnlinePresence" } }),
      ...(service === "paymentProcessing"
        ? {
            salesChannels: ["pos", "eCommerce"],
          }
        : {
            sourceOfFunds: {
              adyenProcessedFunds: false,
              type: "business",
              description: sourceOfFundsBusiness?.description ?? GENERIC_SOURCE_OF_FUNDS_DESCRIPTION,
              amount: {
                currency: sourceOfFundsBusiness?.currency,
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
