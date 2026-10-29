import { createAdminClient } from "@/lib/supabase/admin";
import { hashRawBody } from "./hmac";
import { balanceAccountIdOf, normalizeTransfer, transferResource } from "../transfer-state";

export type AdyenTransferWebhookEnvelope = {
  type: string; // 'balancePlatform.transfer.created' / '.updated'
  environment?: "test" | "live";
  data?: { transfer?: Record<string, unknown> } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Best-effort parse — returns null rather than throwing so the route can respond 400 instead of 500. */
export function parseTransferWebhookBody(rawBody: string): AdyenTransferWebhookEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!isRecord(parsed) || typeof parsed.type !== "string") return null;
    return parsed as AdyenTransferWebhookEnvelope;
  } catch {
    return null;
  }
}

export type AdyenTransferIdentifiers = {
  balanceAccountId: string | null;
  transferReference: string | null;
  transferStatus: string | null;
  amountValue: number | null;
  amountCurrency: string | null;
};

/**
 * Current Adyen docs put the transfer directly under `data` (with the
 * balance account at data.balanceAccount.id); older payloads used
 * data.transfer / balanceAccountId. Both are handled — see
 * transferResource / balanceAccountIdOf in ../transfer-state.ts.
 */
export function extractTransferIdentifiers(body: AdyenTransferWebhookEnvelope): AdyenTransferIdentifiers {
  const transfer = transferResource(body.data);
  const str = (value: unknown): string | null => (typeof value === "string" ? value : null);
  const num = (value: unknown): number | null => (typeof value === "number" ? value : null);
  const amount = isRecord(transfer?.amount) ? transfer!.amount : null;

  return {
    balanceAccountId: balanceAccountIdOf(transfer),
    transferReference: str(transfer?.reference),
    transferStatus: str(transfer?.status),
    amountValue: num(amount?.value),
    amountCurrency: str(amount?.currency),
  };
}

/**
 * Resolves the organisation a transfer webhook belongs to by matching
 * its balance account id against public.balance_accounts (migration
 * 0020), falling back to organisations.adyen_balance_account_id
 * (migration 0010) for orgs created before balance_accounts existed.
 */
async function resolveOrganisationId(
  admin: ReturnType<typeof createAdminClient>,
  ids: AdyenTransferIdentifiers
): Promise<string | null> {
  if (!ids.balanceAccountId) return null;
  const { data: account } = await admin
    .from("balance_accounts")
    .select("organisation_id")
    .eq("adyen_balance_account_id", ids.balanceAccountId)
    .maybeSingle();
  if (account) return account.organisation_id;

  const { data } = await admin
    .from("organisations")
    .select("id")
    .eq("adyen_balance_account_id", ids.balanceAccountId)
    .maybeSingle();
  return data?.id ?? null;
}

export type StoreWebhookResult =
  | { outcome: "stored"; id: string }
  | { outcome: "duplicate" }
  | { outcome: "error"; error: string };

/**
 * Persists a verified transfer webhook — the only thing the route
 * handler does before acking Adyen. Deduped on raw_body_hash via the
 * unique index from migration 0014.
 */
export async function storeTransferWebhookEvent(
  body: AdyenTransferWebhookEnvelope,
  rawBody: string
): Promise<StoreWebhookResult> {
  const admin = createAdminClient();
  const ids = extractTransferIdentifiers(body);
  const organisationId = await resolveOrganisationId(admin, ids);

  const { data, error } = await admin
    .from("adyen_transfer_webhook_events")
    .insert({
      organisation_id: organisationId,
      event_type: body.type,
      live: body.environment === "live",
      balance_account_id: ids.balanceAccountId,
      transfer_reference: ids.transferReference,
      transfer_status: ids.transferStatus,
      amount_value: ids.amountValue,
      amount_currency: ids.amountCurrency,
      raw_body_hash: hashRawBody(rawBody),
      payload: JSON.parse(rawBody),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { outcome: "duplicate" };
    return { outcome: "error", error: error.message };
  }

  return { outcome: "stored", id: data.id };
}

/**
 * Keeps public.transfers (the dashboard's view of money movement) at
 * each transfer's latest state. Adyen can deliver updates out of order,
 * so a webhook only overwrites the row when its sequenceNumber is at
 * least the stored one.
 */
async function upsertTransfer(
  admin: ReturnType<typeof createAdminClient>,
  organisationId: string,
  body: AdyenTransferWebhookEnvelope
): Promise<"stored" | "stale" | "ignored"> {
  const transfer = normalizeTransfer(transferResource(body.data));
  if (!transfer) return "ignored";

  const { data: existing } = await admin
    .from("transfers")
    .select("sequence_number")
    .eq("adyen_transfer_id", transfer.adyen_transfer_id)
    .maybeSingle();
  if (existing && existing.sequence_number > transfer.sequence_number) return "stale";

  const { error } = await admin
    .from("transfers")
    .upsert(
      { ...transfer, organisation_id: organisationId, updated_at: new Date().toISOString() },
      { onConflict: "adyen_transfer_id" }
    );
  if (error) throw new Error(error.message);
  return "stored";
}

/**
 * Reacts to a stored transfer webhook. Deliberately separate from, and
 * called after, storeTransferWebhookEvent — same reasoning as
 * processConfigurationWebhookEvent in ./configuration.ts.
 */
export async function processTransferWebhookEvent(eventId: string, body: AdyenTransferWebhookEnvelope): Promise<void> {
  const admin = createAdminClient();

  try {
    const { data: event } = await admin
      .from("adyen_transfer_webhook_events")
      .select("organisation_id")
      .eq("id", eventId)
      .single();

    let outcome: "stored" | "stale" | "ignored" = "ignored";
    if (
      event?.organisation_id &&
      (body.type === "balancePlatform.transfer.created" || body.type === "balancePlatform.transfer.updated")
    ) {
      outcome = await upsertTransfer(admin, event.organisation_id, body);
    }

    await admin
      .from("adyen_transfer_webhook_events")
      .update({
        processing_status: outcome === "ignored" ? "ignored" : "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventId);
  } catch (err) {
    await admin
      .from("adyen_transfer_webhook_events")
      .update({
        processing_status: "failed",
        error: err instanceof Error ? err.message : String(err),
      })
      .eq("id", eventId);
  }
}
