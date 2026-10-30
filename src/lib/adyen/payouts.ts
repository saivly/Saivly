import { cache } from "react";
import { adyenRequest } from "./client";
import type { PayoutSpeed } from "./payout-fee";

/**
 * On-demand payouts from a balance account to any IBAN.
 *
 * Needs the sendToThirdParty capability on the account holder (Adyen's
 * permission to send money to bank accounts that aren't the org's own
 * verified one), plus a Transfers API key (see config.ts).
 */

export { INSTANT_FEE_RATE, instantFee, type PayoutSpeed } from "./payout-fee";

/**
 * Balance account (on the platform's own account holder) that collects
 * instant-payout fees. Instant payouts are off until it's set.
 */
export function feeBalanceAccountId(): string | null {
  return process.env.ADYEN_PAYOUT_FEE_BALANCE_ACCOUNT_ID || null;
}

/** "nl91 abna 0417 1643 00" -> "NL91ABNA0417164300" */
export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Structure + mod-97 checksum (ISO 13616). Doesn't prove the account exists. */
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

type AccountHolderResponse = {
  capabilities?: { sendToThirdParty?: { enabled?: boolean; allowed?: boolean } };
};

/** Whether Adyen currently allows this account holder to pay out to other bank accounts. */
export const canPayOut = cache(async (accountHolderId: string): Promise<boolean> => {
  const result = await adyenRequest<AccountHolderResponse>(
    "balancePlatform",
    `/accountHolders/${encodeURIComponent(accountHolderId)}`
  );
  const capability = result.ok ? result.data.capabilities?.sendToThirdParty : undefined;
  return Boolean(capability?.enabled && capability?.allowed);
});

type TransferResponse = { id: string; status?: string; reason?: string };

export type TransferResult =
  | { ok: true; transferId: string }
  | { ok: false; reason: "not_configured" | "refused" | "failed"; message?: string };

async function sendTransfer(body: Record<string, unknown>, idempotencyKey: string): Promise<TransferResult> {
  const result = await adyenRequest<TransferResponse>("transfers", "/transfers", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });
  if (!result.ok) {
    if (result.reason === "not_configured") return { ok: false, reason: "not_configured" };
    return { ok: false, reason: "failed", message: result.error?.message };
  }
  if (result.data.status === "refused") return { ok: false, reason: "refused", message: result.data.reason };
  return { ok: true, transferId: result.data.id };
}

/**
 * Sends money from a balance account to an IBAN. The Idempotency-Key makes
 * a retried or double-submitted request return the same transfer instead
 * of paying twice. The row in public.transfers arrives via the webhooks.
 * https://docs.adyen.com/api-explorer/transfers/latest/post/transfers
 */
export function createPayout(input: {
  balanceAccountId: string;
  amount: number; // minor units
  currency: string;
  iban: string;
  recipientName: string;
  referenceForBeneficiary?: string;
  speed: PayoutSpeed;
  reference: string;
  idempotencyKey: string;
}): Promise<TransferResult> {
  return sendTransfer(
    {
      amount: { value: input.amount, currency: input.currency },
      balanceAccountId: input.balanceAccountId,
      category: "bank",
      priority: input.speed === "instant" ? "instant" : "regular",
      counterparty: {
        bankAccount: {
          accountHolder: { fullName: input.recipientName },
          accountIdentification: { type: "iban", iban: input.iban },
        },
      },
      reference: input.reference,
      ...(input.referenceForBeneficiary ? { referenceForBeneficiary: input.referenceForBeneficiary } : {}),
      description: input.speed === "instant" ? "Instant payout" : "Payout",
    },
    input.idempotencyKey
  );
}

/** Moves the instant-payout fee from the org's balance account to the platform's fee account. */
export function collectPayoutFee(input: {
  balanceAccountId: string;
  feeAccountId: string;
  amount: number; // minor units
  currency: string;
  reference: string;
  idempotencyKey: string;
}): Promise<TransferResult> {
  return sendTransfer(
    {
      amount: { value: input.amount, currency: input.currency },
      balanceAccountId: input.balanceAccountId,
      category: "internal",
      counterparty: { balanceAccountId: input.feeAccountId },
      reference: input.reference,
      description: "Instant payout fee",
    },
    input.idempotencyKey
  );
}
