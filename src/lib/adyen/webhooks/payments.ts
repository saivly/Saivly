import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { type ClassicNotificationItem, verifyClassicItemHmac } from "./hmac";

/**
 * Classic Standard/Payment webhook envelope — unlike Configuration/
 * Transfer webhooks, one HTTP POST can batch several notification
 * items, and `live` is the string "true"/"false", not a boolean.
 */
export type AdyenPaymentWebhookEnvelope = {
  live: "true" | "false";
  notificationItems: { NotificationRequestItem: ClassicNotificationItem }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Best-effort parse — returns null rather than throwing so the route can respond 400 instead of 500. */
export function parsePaymentWebhookBody(rawBody: string): AdyenPaymentWebhookEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!isRecord(parsed) || !Array.isArray(parsed.notificationItems)) return null;
    return parsed as AdyenPaymentWebhookEnvelope;
  } catch {
    return null;
  }
}

/**
 * Every item in a batch is signed independently — a partially-forged
 * batch (one genuine item, one tampered) is exactly what per-item
 * verification exists to catch, so one bad signature fails the whole
 * request rather than silently accepting the rest.
 */
export function verifyAllItems(body: AdyenPaymentWebhookEnvelope, hmacKey: string): boolean {
  return body.notificationItems.every((wrapper) => verifyClassicItemHmac(wrapper.NotificationRequestItem, hmacKey));
}

/**
 * Nothing about a classic payment notification identifies an
 * organisation on this platform by itself — merchantAccountCode is the
 * platform's own Adyen merchant account (same value for every org), not
 * a per-org id. Resolving this needs a payments flow that stamps an
 * org's id into merchantReference when a payment is created, which
 * doesn't exist yet (no payments flow exists at all — see the ADYEN
 * business lines created during onboarding, but nothing that takes a
 * payment). Suggested convention once one exists: prefix
 * merchantReference with the organisation's uuid (e.g.
 * `${organisationId}:${orderId}`) so it can be parsed back out here.
 * Until then this always returns null and every row lands with
 * organisation_id unset — still stored, just unlinked.
 */
function resolveOrganisationIdFromMerchantReference(merchantReference: string | undefined): string | null {
  const uuid = merchantReference?.split(":")[0];
  const isUuid = uuid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
  return isUuid ? uuid : null;
}

export type StoreWebhookResult =
  | { outcome: "stored"; id: string }
  | { outcome: "duplicate" }
  | { outcome: "error"; error: string };

/**
 * Persists one already-verified notification item. Deduped on Adyen's
 * own recommended key for classic notifications — (psp_reference,
 * event_code) — via the unique index from migration 0014.
 */
export async function storePaymentWebhookEvent(
  item: ClassicNotificationItem,
  live: boolean
): Promise<StoreWebhookResult> {
  const admin = createAdminClient();
  const organisationId = resolveOrganisationIdFromMerchantReference(item.merchantReference);

  const { data, error } = await admin
    .from("adyen_payment_webhook_events")
    .insert({
      organisation_id: organisationId,
      event_code: item.eventCode ?? "UNKNOWN",
      live,
      psp_reference: item.pspReference ?? "",
      original_reference: item.originalReference ?? null,
      merchant_account_code: item.merchantAccountCode ?? "",
      merchant_reference: item.merchantReference ?? null,
      amount_value: typeof item.amount?.value === "number" ? item.amount.value : null,
      amount_currency: item.amount?.currency ?? null,
      success: item.success === true || item.success === "true",
      reason: null,
      payload: item as unknown as Json,
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
 * Reacts to a stored payment notification. Deliberately separate from,
 * and called after, storePaymentWebhookEvent — same reasoning as
 * processConfigurationWebhookEvent in ./configuration.ts. Nothing to
 * act on yet, so every event is just marked 'processed'.
 */
export async function processPaymentWebhookEvent(eventId: string, item: ClassicNotificationItem): Promise<void> {
  const admin = createAdminClient();

  try {
    switch (item.eventCode) {
      // case "AUTHORISATION":
      //   await handleAuthorisation(...);
      //   break;
      default:
        break;
    }

    await admin
      .from("adyen_payment_webhook_events")
      .update({ processing_status: "processed", processed_at: new Date().toISOString() })
      .eq("id", eventId);
  } catch (err) {
    await admin
      .from("adyen_payment_webhook_events")
      .update({
        processing_status: "failed",
        error: err instanceof Error ? err.message : String(err),
      })
      .eq("id", eventId);
  }
}
