"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBalanceAccount, primaryBalance } from "@/lib/adyen/accounts";
import {
  canPayOut,
  collectPayoutFee,
  createPayout,
  feeBalanceAccountId,
  instantFee,
  isValidIban,
  normalizeIban,
} from "@/lib/adyen/payouts";
import { minorUnitDigits } from "@/lib/dashboard/format";
import { getOrgContext } from "@/lib/dashboard/org";

const PayoutSchema = z.object({
  orgId: z.uuid(),
  balanceAccountId: z.string().min(1),
  amount: z.string().trim().min(1, "Enter an amount."),
  recipientName: z.string().trim().min(1, "Enter the name of the account holder.").max(80, "Use at most 80 characters."),
  iban: z.string().trim().refine(isValidIban, "Enter a valid IBAN."),
  reference: z
    .string()
    .trim()
    .max(80, "Use at most 80 characters for the reference.")
    .optional()
    .transform((v) => v || undefined),
  speed: z.enum(["standard", "instant"]),
  idempotencyKey: z.uuid(),
});

export type PayoutState = { error?: string; ok?: boolean };

/** "1.234,56" / "1234.56" / "1234" -> minor units, or null if it isn't a positive amount. */
function parseAmount(raw: string, currency: string): number | null {
  const digits = minorUnitDigits(currency);
  let s = raw.replace(/[\s€$£]/g, "");
  // Treat the last "," or "." as the decimal separator, drop the others.
  const lastSep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  if (lastSep !== -1 && s.length - lastSep - 1 <= digits) {
    s = s.slice(0, lastSep).replace(/[.,]/g, "") + "." + s.slice(lastSep + 1);
  } else {
    s = s.replace(/[.,]/g, "");
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const minor = Math.round(Number(s) * 10 ** digits);
  return minor > 0 ? minor : null;
}

/**
 * Pays out from one of the org's balance accounts to an IBAN. Owners only.
 * Everything the form sends is re-checked here: the balance account must
 * belong to this org, and amount + fee must fit in the available balance.
 */
export async function payOut(_prev: PayoutState, formData: FormData): Promise<PayoutState> {
  const parsed = PayoutSchema.safeParse({
    orgId: formData.get("orgId"),
    balanceAccountId: formData.get("balanceAccountId"),
    amount: formData.get("amount"),
    recipientName: formData.get("recipientName"),
    iban: formData.get("iban"),
    reference: formData.get("reference") ?? undefined,
    speed: formData.get("speed"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { orgId, balanceAccountId, recipientName, reference, speed, idempotencyKey } = parsed.data;
  const iban = normalizeIban(parsed.data.iban);

  const ctx = await getOrgContext(orgId);
  if (!ctx) return { error: "Organisation not found." };
  if (!ctx.isOwner) return { error: "Only organisation owners can make payouts." };

  const account = ctx.accounts.find((a) => a.adyen_balance_account_id === balanceAccountId);
  if (!account) return { error: "Account not found." };

  const accountHolderId = ctx.organisation.adyen_account_holder_id;
  if (!accountHolderId) return { error: "Finish Adyen verification before making payouts." };

  const feeAccountId = feeBalanceAccountId();
  if (speed === "instant" && (!feeAccountId || account.currency !== "EUR")) {
    return { error: "Instant payouts aren't available for this account." };
  }

  const [allowed, adyenAccount] = await Promise.all([canPayOut(accountHolderId), getBalanceAccount(balanceAccountId)]);
  if (!allowed) return { error: "Payouts aren't enabled for your organisation yet." };

  const amount = parseAmount(parsed.data.amount, account.currency);
  if (!amount) return { error: "Enter a valid amount." };
  const fee = speed === "instant" ? instantFee(amount) : 0;

  const balance = primaryBalance(adyenAccount, account.currency);
  if (!balance) return { error: "Couldn't check your balance. Try again in a moment." };
  if (amount + fee > balance.available) {
    return {
      error: fee
        ? "The amount plus the instant fee is more than your available balance."
        : "The amount is more than your available balance.",
    };
  }

  const result = await createPayout({
    balanceAccountId,
    amount,
    currency: account.currency,
    iban,
    recipientName,
    referenceForBeneficiary: reference,
    speed,
    reference: `payout-${idempotencyKey}`,
    idempotencyKey,
  });

  if (!result.ok) {
    console.error(`[payouts] payout for org ${orgId} failed (${result.reason}):`, result.message);
    if (result.reason === "not_configured") return { error: "Payouts aren't set up on the server yet. Contact support." };
    if (result.reason === "refused") return { error: "Adyen refused the payout. Contact support." };
    return { error: "The payout couldn't be started. Try again in a moment." };
  }

  if (fee && feeAccountId) {
    // The payout has already gone out, so a failed fee is logged for
    // follow-up rather than shown as a failed payout.
    const feeResult = await collectPayoutFee({
      balanceAccountId,
      feeAccountId,
      amount: fee,
      currency: account.currency,
      reference: `payout-fee-${idempotencyKey}`,
      idempotencyKey: `${idempotencyKey}-fee`,
    });
    if (!feeResult.ok) {
      console.error(
        `[payouts] instant fee of ${fee} ${account.currency} for payout ${result.transferId} (org ${orgId}) not collected (${feeResult.reason}):`,
        feeResult.message
      );
    }
  }

  revalidatePath(`/org/${orgId}/payments`);
  return { ok: true };
}
