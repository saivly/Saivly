import { randomUUID } from "node:crypto";
import { adyenRequest } from "./client";
import { ADYEN_BALANCE_PLATFORM_NAME } from "./config";

type AccountHolderResponse = { id: string };

/**
 * Balance Platform account holder for an organisation — the thing capable
 * of holding money, linked to its legal entity (created separately via
 * createAdyenOrganization in legalEntity.ts). No `capabilities` are
 * requested explicitly; Adyen applies its own defaults for the balance
 * platform, configured on the account holder afterward as needed.
 * https://docs.adyen.com/api-explorer/balanceplatform/latest/post/accountHolders
 */
export async function createAdyenAccountHolder(
  legalEntityId: string,
  organisationName: string
): Promise<string | null> {
  const result = await adyenRequest<AccountHolderResponse>("balancePlatform", "/accountHolders", {
    method: "POST",
    body: JSON.stringify({
      legalEntityId,
      // Required by the schema even when requesting nothing specific —
      // Adyen fills in the balance platform's own defaults.
      capabilities: {},
      description: `Account holder for ${organisationName}`,
      reference: randomUUID(),
      ...(ADYEN_BALANCE_PLATFORM_NAME ? { balancePlatform: ADYEN_BALANCE_PLATFORM_NAME } : {}),
    }),
  });

  return result.ok ? result.data.id : null;
}

type BalanceAccountResponse = { id: string };

/**
 * Balance account for an account holder — where the organisation's
 * payments actually land. One account holder can have several; this app
 * only ever creates one, at company-onboarding time.
 * https://docs.adyen.com/api-explorer/balanceplatform/latest/post/balanceAccounts
 */
export async function createAdyenBalanceAccount(
  accountHolderId: string,
  organisationName: string
): Promise<string | null> {
  const result = await adyenRequest<BalanceAccountResponse>("balancePlatform", "/balanceAccounts", {
    method: "POST",
    body: JSON.stringify({
      accountHolderId,
      description: `Balance account for ${organisationName}`,
      reference: randomUUID(),
    }),
  });

  return result.ok ? result.data.id : null;
}
