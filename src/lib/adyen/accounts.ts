import { randomUUID } from "node:crypto";
import { cache } from "react";
import { adyenRequest } from "./client";
import { maskIban } from "./transfer-state";

/**
 * Live, read-only views of an organisation's Adyen balance accounts for
 * the dashboard. Nothing here is stored — balances change with every
 * transfer, so they are always read from Adyen. Each call is wrapped in
 * React's cache() so one page render never asks Adyen twice for the
 * same account.
 *
 * Every function returns null (not throws) when Adyen isn't configured
 * or the call fails, and the UI shows "unavailable" instead.
 */

export type AdyenBalance = {
  currency: string;
  balance: number; // minor units
  available: number;
  reserved: number;
  pending: number;
};

export type AdyenBalanceAccount = {
  id: string;
  status: "active" | "inactive" | "suspended" | "closed";
  defaultCurrencyCode: string;
  balances: AdyenBalance[];
};

export const getBalanceAccount = cache(async (balanceAccountId: string): Promise<AdyenBalanceAccount | null> => {
  const result = await adyenRequest<AdyenBalanceAccount>(
    "balancePlatform",
    `/balanceAccounts/${encodeURIComponent(balanceAccountId)}`
  );
  return result.ok ? result.data : null;
});

/** The balance in the account's own currency (an account can hold several). */
export function primaryBalance(account: AdyenBalanceAccount | null, currency: string): AdyenBalance | null {
  if (!account) return null;
  return account.balances.find((b) => b.currency === currency) ?? account.balances[0] ?? null;
}

type PaymentInstrumentsResponse = {
  paymentInstruments?: {
    id: string;
    type: string;
    status?: string;
    bankAccount?: { iban?: string; accountNumber?: string };
  }[];
};

/** The account's IBAN, formatted in groups of four, if Adyen has issued one. */
export const getBalanceAccountIban = cache(async (balanceAccountId: string): Promise<string | null> => {
  const result = await adyenRequest<PaymentInstrumentsResponse>(
    "balancePlatform",
    `/balanceAccounts/${encodeURIComponent(balanceAccountId)}/paymentInstruments`
  );
  if (!result.ok) return null;
  const iban = result.data.paymentInstruments?.find((pi) => pi.type === "bankAccount" && pi.bankAccount?.iban)
    ?.bankAccount?.iban;
  return iban ? iban.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim() : null;
});

export type PayoutSchedule = {
  schedule: "daily" | "weekly" | "monthly" | "balance" | "cron" | string;
  destination: string | null; // masked IBAN
};

type SweepsResponse = {
  sweeps?: {
    status?: string;
    type?: string;
    category?: string;
    schedule?: { type?: string };
    counterparty?: { transferInstrumentId?: string };
  }[];
};

type TransferInstrumentResponse = {
  bankAccount?: { accountIdentification?: { iban?: string; accountNumber?: string } };
};

/**
 * The account's automatic payout ("sweep" to a bank account), if one is
 * set up. Null means no payout schedule exists yet — the org hasn't
 * added a payout bank account (onboarding deliberately skips that, see
 * createAdyenAccountHolder).
 */
export const getPayoutSchedule = cache(async (balanceAccountId: string): Promise<PayoutSchedule | null> => {
  const result = await adyenRequest<SweepsResponse>(
    "balancePlatform",
    `/balanceAccounts/${encodeURIComponent(balanceAccountId)}/sweeps`
  );
  if (!result.ok) return null;
  const sweep = result.data.sweeps?.find(
    (s) => s.status !== "inactive" && s.type === "push" && s.counterparty?.transferInstrumentId
  );
  if (!sweep) return null;

  let destination: string | null = null;
  const instrumentId = sweep.counterparty?.transferInstrumentId;
  if (instrumentId) {
    const instrument = await adyenRequest<TransferInstrumentResponse>(
      "legalEntity",
      `/transferInstruments/${encodeURIComponent(instrumentId)}`
    );
    const identification = instrument.ok ? instrument.data.bankAccount?.accountIdentification : undefined;
    if (identification?.iban) destination = maskIban(identification.iban);
    else if (identification?.accountNumber) destination = `···· ${identification.accountNumber.slice(-4)}`;
  }

  return { schedule: sweep.schedule?.type ?? "daily", destination };
});

/**
 * An additional balance account ("Open account" on the Accounts page)
 * under the organisation's existing account holder.
 * https://docs.adyen.com/api-explorer/balanceplatform/latest/post/balanceAccounts
 */
export async function createBalanceAccount(
  accountHolderId: string,
  description: string,
  currency: string
): Promise<string | null> {
  const result = await adyenRequest<{ id: string }>("balancePlatform", "/balanceAccounts", {
    method: "POST",
    body: JSON.stringify({
      accountHolderId,
      description,
      defaultCurrencyCode: currency,
      reference: randomUUID(),
    }),
  });
  return result.ok ? result.data.id : null;
}
