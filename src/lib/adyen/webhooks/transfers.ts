import { createAdminClient } from "@/lib/supabase/admin";
import { hashRawBody } from "./hmac";

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
 * NOT yet confirmed field-by-field against a real transfer.created/
 * .updated payload — the transfer resource's shape (balanceAccountId,
 * reference, status, amount) is transcribed from Adyen's API Explorer
 * description, not a payload this app has actually received yet.
 * Confirm against a real sandbox notification before relying on this.
 */
export function extractTransferIdentifiers(body: AdyenTransferWebhookEnvelope): AdyenTransferIdentifiers {
  const transfer = isRecord(body.data?.transfer) ? body.data!.transfer! : null;
  const str = (value: unknown): string | null => (typeof value === "string" ? value : null);
  const num = (value: unknown): number | null => (typeof value === "number" ? value : null);
  const amount = isRecord(transfer?.amount) ? transfer!.amount : null;

  return {
    balanceAccountId: str(transfer?.balanceAccountId),
    transferReference: str(transfer?.reference),
    transferStatus: str(transfer?.status),
    amountValue: num(amount?.value),
    amountCurrency: str(amount?.currency),
  };
}

/**
 * Resolves the organisation a transfer webhook belongs to by matching
 * its balance account id against organisations.adyen_balance_account_id
 * (migration 0010). A transfer has both a source and destination side —
 * this only sees whichever balanceAccountId sits on the transfer
 * resource itself; if that's not enough once real payloads are in hand
 * (e.g. an org needs to see transfers where it's the counterparty too),
 * extend this to also check the payload's counterparty fields.
 */
async function resolveOrganisationId(
  admin: ReturnType<typeof createAdminClient>,
  ids: AdyenTransferIdentifiers
): Promise<string | null> {
  if (!ids.balanceAccountId) return null;
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
 * Reacts to a stored transfer webhook. Deliberately separate from, and
 * called after, storeTransferWebhookEvent — same reasoning as
 * processConfigurationWebhookEvent in ./configuration.ts. Nothing to
 * act on yet, so every event is just marked 'processed'.
 */
export async function processTransferWebhookEvent(eventId: string, body: AdyenTransferWebhookEnvelope): Promise<void> {
  const admin = createAdminClient();

  try {
    switch (body.type) {
      // case "balancePlatform.transfer.updated":
      //   await handleTransferUpdated(...);
      //   break;
      default:
        break;
    }

    await admin
      .from("adyen_transfer_webhook_events")
      .update({ processing_status: "processed", processed_at: new Date().toISOString() })
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
