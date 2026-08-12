import { randomUUID } from "node:crypto";
import { adyenRequest } from "./client";
import { ADYEN_BALANCE_PLATFORM_NAME } from "./config";

type AccountHolderResponse = { id: string };

/**
 * Balance Platform account holder for an organisation — the thing capable
 * of holding money, linked to its legal entity (created separately via
 * createAdyenOrganization in legalEntity.ts).
 *
 * sendToTransferInstrument is explicitly turned off: it's the capability
 * that lets funds be paid out to a verified bank account, and it's what
 * was causing Adyen's hosted onboarding to keep asking for one regardless
 * of the onboardingLinks "settings" object (that only controls UI
 * behavior, not which capabilities get collected for). This is a real
 * functional trade-off, not just hiding a step: with it off, this
 * account holder cannot receive payouts until the capability is
 * requested later (e.g. a PATCH from a "add payout details" feature in
 * the dashboard, once one exists) — not something to flip without that
 * follow-up in mind. Every other capability still falls back to the
 * balance platform's own configured defaults.
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
      capabilities: {
        sendToTransferInstrument: { requested: false },
      },
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
