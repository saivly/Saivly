"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createBalanceAccount } from "@/lib/adyen/accounts";
import { canIssueBankAccount, ensureBankAccount, issuingCountry } from "@/lib/adyen/bank-accounts";
import { getOrgContext } from "@/lib/dashboard/org";
import { bankAccountLimit } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { ACCOUNT_CURRENCIES } from "@/lib/dashboard/constants";

const OpenAccountSchema = z.object({
  orgId: z.uuid(),
  name: z.string().trim().min(1, "Enter a name for the account.").max(60, "Use at most 60 characters."),
  currency: z.enum(ACCOUNT_CURRENCIES),
});

export type OpenAccountState = { error?: string; ok?: boolean };

/**
 * Opens an extra bank account: an Adyen balance account under the org's
 * existing account holder, recorded in balance_accounts, with an IBAN
 * issued on it. Owners only (also enforced by RLS on the insert), and
 * capped per plan (see BANK_ACCOUNT_LIMITS).
 */
export async function openAccount(_prev: OpenAccountState, formData: FormData): Promise<OpenAccountState> {
  const parsed = OpenAccountSchema.safeParse({
    orgId: formData.get("orgId"),
    name: formData.get("name"),
    currency: formData.get("currency"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { orgId, name, currency } = parsed.data;

  const ctx = await getOrgContext(orgId);
  if (!ctx) return { error: "Organisation not found." };
  if (!ctx.isOwner) return { error: "Only organisation owners can open accounts." };
  const accountHolderId = ctx.organisation.adyen_account_holder_id;
  if (!accountHolderId) return { error: "Finish Adyen verification before opening more accounts." };

  const limit = bankAccountLimit(ctx.organisation.plan);
  if (limit !== null && ctx.accounts.length >= limit) {
    return {
      error:
        limit === 1
          ? "Your plan includes 1 bank account. Upgrade to Pro for up to 5."
          : "You've reached the maximum number of bank accounts for your plan.",
    };
  }
  if (!(await canIssueBankAccount(accountHolderId))) {
    return { error: "Adyen hasn't approved bank accounts for your organisation yet." };
  }

  const adyenId = await createBalanceAccount(accountHolderId, `${name} — ${ctx.organisation.name}`, currency);
  if (!adyenId) return { error: "Adyen couldn't open the account. Try again in a moment." };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("balance_accounts")
    .insert({
      organisation_id: orgId,
      adyen_balance_account_id: adyenId,
      name,
      currency,
    })
    .select("id, adyen_balance_account_id")
    .single();
  if (error) {
    // The Adyen account exists but isn't linked — log the id so it can be
    // linked by hand rather than silently orphaned.
    console.error(`[accounts] Adyen balance account ${adyenId} created but not saved:`, error.message);
    return { error: "The account was opened but couldn't be saved. Contact support." };
  }

  const issued = await ensureBankAccount(
    createAdminClient(),
    row,
    issuingCountry(ctx.organisation.country),
    `${name} — ${ctx.organisation.name}`
  );
  if (issued === "failed") {
    revalidatePath(`/org/${orgId}/accounts`);
    return { error: "The account was opened, but Adyen couldn't issue its IBAN yet. Contact support." };
  }

  revalidatePath(`/org/${orgId}/accounts`);
  return { ok: true };
}
