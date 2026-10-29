import { createAdminClient } from "@/lib/supabase/admin";
import { hashRawBody } from "./hmac";

export type AdyenConfigurationWebhookEnvelope = {
  type: string; // 'balancePlatform.accountHolder.updated', 'balancePlatform.legalEntity.createdUpdated', ...
  environment?: "test" | "live";
  data?: Record<string, unknown> | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Best-effort parse — returns null rather than throwing so the route can respond 400 instead of 500. */
export function parseConfigurationWebhookBody(rawBody: string): AdyenConfigurationWebhookEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!isRecord(parsed) || typeof parsed.type !== "string") return null;
    return parsed as AdyenConfigurationWebhookEnvelope;
  } catch {
    return null;
  }
}

/**
 * Adyen nests the actual event object one level under `data`, keyed by
 * an entity name that varies per event type (data.balanceAccount for
 * balancePlatform.balanceAccount.*, data.accountHolder for
 * balancePlatform.accountHolder.*, data.legalEntity for
 * balancePlatform.legalEntity.*) — reach into whichever one is there
 * rather than hardcoding a key per event type.
 *
 * NOT yet confirmed field-by-field against real payloads — treat the
 * ids this pulls out as best-effort until checked against a real
 * sandbox notification (Customer Area lets you send test webhooks).
 */
function eventEntity(body: AdyenConfigurationWebhookEnvelope): Record<string, unknown> | null {
  if (!isRecord(body.data)) return null;
  const nested = Object.values(body.data).find(isRecord);
  return nested ?? body.data;
}

export type AdyenConfigurationIdentifiers = {
  balanceAccountId: string | null;
  accountHolderId: string | null;
  legalEntityId: string | null;
};

export function extractConfigurationIdentifiers(
  body: AdyenConfigurationWebhookEnvelope
): AdyenConfigurationIdentifiers {
  const entity = eventEntity(body);
  const str = (value: unknown): string | null => (typeof value === "string" ? value : null);

  return {
    balanceAccountId:
      str(entity?.balanceAccountId) ?? (body.type.includes("balanceAccount") ? str(entity?.id) : null),
    accountHolderId:
      str(entity?.accountHolderId) ?? (body.type.includes("accountHolder") ? str(entity?.id) : null),
    legalEntityId: body.type.includes("legalEntity") ? str(entity?.id) : null,
  };
}

/**
 * Resolves the organisation a configuration webhook belongs to by
 * matching whichever id it carries against the ids stored on
 * organisations at onboarding time (migration 0010). Returns null when
 * nothing matches — the event is still stored with organisation_id left
 * null rather than dropped.
 */
async function resolveOrganisationId(
  admin: ReturnType<typeof createAdminClient>,
  ids: AdyenConfigurationIdentifiers
): Promise<string | null> {
  if (ids.balanceAccountId) {
    // Orgs can have several balance accounts (migration 0020); only the
    // first one is also on organisations, so check balance_accounts first
    // — same lookup as the transfer webhooks.
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
    if (data) return data.id;
  }
  if (ids.accountHolderId) {
    const { data } = await admin
      .from("organisations")
      .select("id")
      .eq("adyen_account_holder_id", ids.accountHolderId)
      .maybeSingle();
    if (data) return data.id;
  }
  if (ids.legalEntityId) {
    const { data } = await admin
      .from("organisations")
      .select("id")
      .eq("adyen_organization_legal_entity_id", ids.legalEntityId)
      .maybeSingle();
    if (data) return data.id;
  }
  return null;
}

export type StoreWebhookResult =
  | { outcome: "stored"; id: string }
  | { outcome: "duplicate" }
  | { outcome: "error"; error: string };

/**
 * Persists a verified configuration webhook — the only thing the route
 * handler does before acking Adyen. Deduped on raw_body_hash via the
 * unique index from migration 0014.
 */
export async function storeConfigurationWebhookEvent(
  body: AdyenConfigurationWebhookEnvelope,
  rawBody: string
): Promise<StoreWebhookResult> {
  const admin = createAdminClient();
  const ids = extractConfigurationIdentifiers(body);
  const organisationId = await resolveOrganisationId(admin, ids);

  const { data, error } = await admin
    .from("adyen_configuration_webhook_events")
    .insert({
      organisation_id: organisationId,
      event_type: body.type,
      live: body.environment === "live",
      balance_account_id: ids.balanceAccountId,
      account_holder_id: ids.accountHolderId,
      legal_entity_id: ids.legalEntityId,
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
 * Reacts to a stored configuration webhook. Deliberately separate from,
 * and called after, storeConfigurationWebhookEvent — a bug or thrown
 * error here updates this row's status to 'failed' rather than ever
 * risking Adyen seeing a non-2xx and retrying a notification that's
 * already durably stored.
 *
 * Add a case per event type as this app starts acting on them (e.g.
 * flipping an organisation's verification/payout-ready status from
 * accountHolder capability events). Nothing to do yet, so every event
 * is just marked 'processed'.
 */
export async function processConfigurationWebhookEvent(
  eventId: string,
  body: AdyenConfigurationWebhookEnvelope
): Promise<void> {
  const admin = createAdminClient();

  try {
    switch (body.type) {
      // case "balancePlatform.accountHolder.updated":
      //   await handleAccountHolderUpdated(...);
      //   break;
      default:
        break;
    }

    await admin
      .from("adyen_configuration_webhook_events")
      .update({ processing_status: "processed", processed_at: new Date().toISOString() })
      .eq("id", eventId);
  } catch (err) {
    await admin
      .from("adyen_configuration_webhook_events")
      .update({
        processing_status: "failed",
        error: err instanceof Error ? err.message : String(err),
      })
      .eq("id", eventId);
  }
}
