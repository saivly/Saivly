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

/**
 * HMAC keys for verifying inbound webhook notifications (see
 * src/lib/adyen/webhooks/*.ts) — not API keys for calling out to Adyen,
 * so they don't fit ADYEN_SERVICES above. Adyen treats Payment,
 * Configuration, and Transfer webhooks as separate subscriptions in the
 * Customer Area (Developers > Webhooks), each with its own URL and its
 * own "Generate HMAC key" — hence one env var pair per category rather
 * than one shared key.
 */
export type AdyenWebhookCategory = "payments" | "configuration" | "transfers";

const ADYEN_WEBHOOK_HMAC_ENV: Record<AdyenWebhookCategory, { sandbox: string; production: string }> = {
  payments: {
    sandbox: "ADYEN_SANDBOX_PAYMENTS_WEBHOOK_HMAC_KEY",
    production: "ADYEN_PRODUCTION_PAYMENTS_WEBHOOK_HMAC_KEY",
  },
  configuration: {
    sandbox: "ADYEN_SANDBOX_CONFIGURATION_WEBHOOK_HMAC_KEY",
    production: "ADYEN_PRODUCTION_CONFIGURATION_WEBHOOK_HMAC_KEY",
  },
  transfers: {
    sandbox: "ADYEN_SANDBOX_TRANSFERS_WEBHOOK_HMAC_KEY",
    production: "ADYEN_PRODUCTION_TRANSFERS_WEBHOOK_HMAC_KEY",
  },
};

export function adyenWebhookHmacKey(category: AdyenWebhookCategory): string | null {
  const envNames = ADYEN_WEBHOOK_HMAC_ENV[category];
  const isProduction = process.env.ADYEN_ENVIRONMENT === "live" || null;
  const key = isProduction ? process.env[envNames.production] : process.env[envNames.sandbox];
  return key || null;
}

/**
 * HTTP Basic auth credentials for inbound webhook notifications — a
 * second, independent layer on top of HMAC signing. Configured per
 * webhook subscription in the Customer Area ("User name"/"Password"
 * under the same Server configuration screen as the URL), so it's keyed
 * per category + environment exactly like the HMAC keys above.
 */
const ADYEN_WEBHOOK_BASIC_AUTH_ENV: Record<
  AdyenWebhookCategory,
  { sandboxUser: string; sandboxPassword: string; productionUser: string; productionPassword: string }
> = {
  payments: {
    sandboxUser: "ADYEN_SANDBOX_PAYMENTS_WEBHOOK_USERNAME",
    sandboxPassword: "ADYEN_SANDBOX_PAYMENTS_WEBHOOK_PASSWORD",
    productionUser: "ADYEN_PRODUCTION_PAYMENTS_WEBHOOK_USERNAME",
    productionPassword: "ADYEN_PRODUCTION_PAYMENTS_WEBHOOK_PASSWORD",
  },
  configuration: {
    sandboxUser: "ADYEN_SANDBOX_CONFIGURATION_WEBHOOK_USERNAME",
    sandboxPassword: "ADYEN_SANDBOX_CONFIGURATION_WEBHOOK_PASSWORD",
    productionUser: "ADYEN_PRODUCTION_CONFIGURATION_WEBHOOK_USERNAME",
    productionPassword: "ADYEN_PRODUCTION_CONFIGURATION_WEBHOOK_PASSWORD",
  },
  transfers: {
    sandboxUser: "ADYEN_SANDBOX_TRANSFERS_WEBHOOK_USERNAME",
    sandboxPassword: "ADYEN_SANDBOX_TRANSFERS_WEBHOOK_PASSWORD",
    productionUser: "ADYEN_PRODUCTION_TRANSFERS_WEBHOOK_USERNAME",
    productionPassword: "ADYEN_PRODUCTION_TRANSFERS_WEBHOOK_PASSWORD",
  },
};

export type AdyenWebhookBasicAuthCredentials = { username: string; password: string };

export function adyenWebhookBasicAuth(category: AdyenWebhookCategory): AdyenWebhookBasicAuthCredentials | null {
  const envNames = ADYEN_WEBHOOK_BASIC_AUTH_ENV[category];
  const isProduction = process.env.ADYEN_ENVIRONMENT === "live" || null;
  const username = isProduction ? process.env[envNames.productionUser] : process.env[envNames.sandboxUser];
  const password = isProduction ? process.env[envNames.productionPassword] : process.env[envNames.sandboxPassword];
  if (!username || !password) return null;
  return { username, password };
}
