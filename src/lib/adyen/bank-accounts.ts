import { createAdminClient } from "@/lib/supabase/admin";
import { adyenRequest, type AdyenResult } from "./client";

/**
 * Bank accounts = an Adyen balance account with an IBAN issued on it
 * (a payment instrument of type bankAccount). Every row in
 * public.balance_accounts gets one once Adyen allows it.
 */

type Admin = ReturnType<typeof createAdminClient>;

type AccountHolderResponse = {
  capabilities?: { issueBankAccount?: { allowed?: boolean; enabled?: boolean; verificationStatus?: string } };
};

/** Whether Adyen lets this account holder have IBANs issued. */
export async function canIssueBankAccount(accountHolderId: string): Promise<boolean> {
  const result = await adyenRequest<AccountHolderResponse>(
    "balancePlatform",
    `/accountHolders/${encodeURIComponent(accountHolderId)}`
  );
  const capability = result.ok ? result.data.capabilities?.issueBankAccount : undefined;
  return Boolean(capability?.allowed && capability?.enabled && capability?.verificationStatus === "valid");
}

type Instrument = { id: string; iban: string | null };
type InstrumentResult = { ok: true; instrument: Instrument | null } | { ok: false; error: string };

/** Adyen's failure as one readable line, e.g. "422 30_016: Not allowed". */
function describeAdyenError(result: Exclude<AdyenResult<unknown>, { ok: true }>): string {
  if (result.reason === "not_configured") return "Adyen API key not configured";
  const parts = [result.status, result.error?.errorCode].filter(Boolean).join(" ");
  const message = result.error?.message ?? "request failed";
  return parts ? `${parts}: ${message}` : message;
}

type PaymentInstrumentResponse = { id: string; bankAccount?: { iban?: string } };

/**
 * Issues an IBAN on a balance account.
 * https://docs.adyen.com/api-explorer/balanceplatform/2/post/paymentInstruments
 */
async function createBankAccountInstrument(
  balanceAccountId: string,
  issuingCountryCode: string,
  description: string
): Promise<InstrumentResult> {
  const result = await adyenRequest<PaymentInstrumentResponse>("balancePlatform", "/paymentInstruments", {
    method: "POST",
    body: JSON.stringify({ type: "bankAccount", balanceAccountId, issuingCountryCode, description }),
  });
  if (!result.ok) return { ok: false, error: `create: ${describeAdyenError(result)}` };
  return {
    ok: true,
    instrument: { id: result.data.id, iban: result.data.bankAccount?.iban?.replace(/\s+/g, "") ?? null },
  };
}

type InstrumentsResponse = { paymentInstruments?: { id: string; type: string; bankAccount?: { iban?: string } }[] };

/** An IBAN already issued on the balance account (e.g. a previous attempt whose save failed). */
async function findExistingBankAccount(balanceAccountId: string): Promise<InstrumentResult> {
  const result = await adyenRequest<InstrumentsResponse>(
    "balancePlatform",
    `/balanceAccounts/${encodeURIComponent(balanceAccountId)}/paymentInstruments`
  );
  if (!result.ok) return { ok: false, error: `lookup: ${describeAdyenError(result)}` };
  const pi = result.data.paymentInstruments?.find((p) => p.type === "bankAccount");
  return { ok: true, instrument: pi ? { id: pi.id, iban: pi.bankAccount?.iban?.replace(/\s+/g, "") ?? null } : null };
}

/** Claims older than this are treated as abandoned (a crash mid-request) and can be retried. */
const CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Issues an IBAN for one balance_accounts row, unless it already has one.
 * Safe to call any number of times, concurrently too: the row is claimed
 * first, so only one caller talks to Adyen, and Adyen is checked for an
 * existing IBAN before a new one is issued.
 */
export async function ensureBankAccount(
  admin: Admin,
  row: { id: string; adyen_balance_account_id: string },
  issuingCountryCode: string,
  description: string
): Promise<"issued" | "exists" | "busy" | "failed"> {
  const staleBefore = new Date(Date.now() - CLAIM_TIMEOUT_MS).toISOString();
  const { data: claimed } = await admin
    .from("balance_accounts")
    .update({ bank_account_claimed_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("adyen_payment_instrument_id", null)
    .or(`bank_account_claimed_at.is.null,bank_account_claimed_at.lt.${staleBefore}`)
    .select("id")
    .maybeSingle();
  if (!claimed) {
    const { data: current } = await admin
      .from("balance_accounts")
      .select("adyen_payment_instrument_id")
      .eq("id", row.id)
      .maybeSingle();
    return current?.adyen_payment_instrument_id ? "exists" : "busy";
  }

  // Only create one when the lookup worked and found nothing; a failed
  // lookup must not risk issuing a second IBAN.
  const existing = await findExistingBankAccount(row.adyen_balance_account_id);
  const result =
    existing.ok && !existing.instrument
      ? await createBankAccountInstrument(row.adyen_balance_account_id, issuingCountryCode, description)
      : existing;

  if (!result.ok || !result.instrument) {
    const reason = result.ok ? "no instrument returned" : result.error;
    await admin.from("balance_accounts").update({ bank_account_claimed_at: null }).eq("id", row.id);
    console.error(
      `[bank-accounts] couldn't issue an IBAN for balance account ${row.adyen_balance_account_id} (${issuingCountryCode}): ${reason}`
    );
    return "failed";
  }
  const instrument = result.instrument;

  const { error } = await admin
    .from("balance_accounts")
    .update({ adyen_payment_instrument_id: instrument.id, iban: instrument.iban })
    .eq("id", row.id);
  if (error) {
    // Adyen has it; the next call finds it via findExistingBankAccount once the claim expires.
    console.error(`[bank-accounts] IBAN ${instrument.id} issued but not saved:`, error.message);
    return "failed";
  }
  return "issued";
}

/**
 * Issues the org's primary IBAN once both are true:
 *  - an owner has finished Adyen onboarding (profiles.adyen_onboarding_completed_at)
 *  - Adyen reports the issueBankAccount capability as valid
 * Called when onboarding finishes and on every account-holder webhook,
 * because the capability usually turns valid a while after onboarding.
 */
export async function ensurePrimaryBankAccount(organisationId: string): Promise<void> {
  const admin = createAdminClient();

  const [{ data: org }, { data: primary }, { data: owners }] = await Promise.all([
    admin.from("organisations").select("name, country, adyen_account_holder_id").eq("id", organisationId).maybeSingle(),
    admin
      .from("balance_accounts")
      .select("id, adyen_balance_account_id, adyen_payment_instrument_id")
      .eq("organisation_id", organisationId)
      .eq("is_primary", true)
      .maybeSingle(),
    admin.from("organisation_members").select("user_id").eq("organisation_id", organisationId).eq("role", "owner"),
  ]);
  if (!org?.adyen_account_holder_id || !primary || primary.adyen_payment_instrument_id) return;

  const ownerIds = (owners ?? []).map((o) => o.user_id);
  if (ownerIds.length === 0) return;
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("id", ownerIds)
    .not("adyen_onboarding_completed_at", "is", null);
  if (!count) return;

  if (!(await canIssueBankAccount(org.adyen_account_holder_id))) return;

  await ensureBankAccount(admin, primary, issuingCountry(org.country), `Bank account — ${org.name}`);
}

/** Adyen issues IBANs in the org's own country; NL when it isn't known. */
export function issuingCountry(country: string | null | undefined): string {
  return country && /^[A-Z]{2}$/.test(country) ? country : "NL";
}
