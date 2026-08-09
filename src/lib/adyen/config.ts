// Central registry of Adyen services this app talks to. Each service has
// its own API key and base URL in Adyen's world (LEM, Balance Platform,
// Transfers, ... are separate products), so config is keyed per service
// rather than assuming one global apiKey/baseUrl pair.

export type AdyenServiceName = "legalEntity";

type AdyenServiceDef = {
  apiKeyEnv: string;
  sandboxBaseUrl: string;
  productionBaseUrl: string;
};

const ADYEN_SERVICES: Record<AdyenServiceName, AdyenServiceDef> = {
  legalEntity: {
    apiKeyEnv: "ADYEN_LEGALENTITY_API_KEY",
    sandboxBaseUrl: "https://kyc-test.adyen.com/lem/v4",
    productionBaseUrl: "https://kyc-live.adyen.com/lem/v4",
  },
  // balancePlatform: { apiKeyEnv: "ADYEN_BALANCEPLATFORM_API_KEY", ... },
  // transfers: { apiKeyEnv: "ADYEN_TRANSFERS_API_KEY", ... },
};

export type AdyenConfig = { apiKey: string; baseUrl: string };

export function adyenConfig(service: AdyenServiceName): AdyenConfig | null {
  const def = ADYEN_SERVICES[service];
  const apiKey = process.env[def.apiKeyEnv];
  if (!apiKey) return null;

  const isProduction = process.env.ADYEN_ENVIRONMENT === "live" || null;
  const baseUrl = isProduction ? def.productionBaseUrl : def.sandboxBaseUrl;

  return { apiKey, baseUrl };
}
