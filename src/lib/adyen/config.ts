// Central registry of Adyen services this app talks to. Each service has
// its own API key and base URL in Adyen's world (LEM, Balance Platform,
// Transfers, ... are separate products), so config is keyed per service
// rather than assuming one global apiKey/baseUrl pair.

export type AdyenServiceName = "legalEntity" | "balancePlatform";

type AdyenServiceDef = {
  sandboxApiKey: string;
  productionApiKey: string;
  sandboxBaseUrl: string;
  productionBaseUrl: string;
};

const ADYEN_SERVICES: Record<AdyenServiceName, AdyenServiceDef> = {
  legalEntity: {
    sandboxApiKey: "ADYEN_SANDBOX_LEGALENTITY_API_KEY",
    productionApiKey: "ADYEN_PRODUCTION_LEGALENTITY_API_KEY",
    sandboxBaseUrl: "https://kyc-test.adyen.com/lem/v4",
    productionBaseUrl: "https://kyc-live.adyen.com/lem/v4",
  },
  // "Configuration API" in Adyen's own docs, commonly called the Balance
  // Platform API — separate product/credentials from Legal Entity
  // Management above. Creates account holders + balance accounts.
  balancePlatform: {
    sandboxApiKey: "ADYEN_SANDBOX_BALANCEPLATFORM_API_KEY",
    productionApiKey: "ADYEN_PRODUCTION_BALANCEPLATFORM_API_KEY",
    sandboxBaseUrl: "https://balanceplatform-api-test.adyen.com/bcl/v2",
    productionBaseUrl: "https://balanceplatform-api-live.adyen.com/bcl/v2",
  },
  // transfers: { apiKeyEnv: "ADYEN_TRANSFERS_API_KEY", ... },
};

// Not a secret — the balance platform your account holders belong to
// (set in the Adyen Customer Area). Only required if your API credentials
// span multiple balance platforms; see createAccountHolder() in
// balancePlatform.ts.
export const ADYEN_BALANCE_PLATFORM_NAME = process.env.ADYEN_BALANCE_PLATFORM_NAME;

export type AdyenConfig = { apiKey: string; baseUrl: string };

export function adyenConfig(service: AdyenServiceName): AdyenConfig | null {
  const def = ADYEN_SERVICES[service];
  const isProduction = process.env.ADYEN_ENVIRONMENT === "live" || null;
  const apiKey = isProduction ? process.env[def.productionApiKey] : process.env[def.sandboxApiKey];
  if (!apiKey) return null;
  const baseUrl = isProduction ? def.productionBaseUrl : def.sandboxBaseUrl;

  return { apiKey, baseUrl };
}
