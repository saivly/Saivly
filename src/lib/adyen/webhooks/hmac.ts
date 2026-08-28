import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Constant-time compare of two base64 signatures. Decodes first so
 * differing-length inputs (e.g. a header stripped/padded oddly) fail
 * the length check rather than throwing out of timingSafeEqual.
 */
function signaturesMatch(expectedBase64: string, actualBase64: string): boolean {
  let expectedBuf: Buffer;
  let actualBuf: Buffer;
  try {
    expectedBuf = Buffer.from(expectedBase64, "base64");
    actualBuf = Buffer.from(actualBase64, "base64");
  } catch {
    return false;
  }
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Verifies the HMAC-SHA256 signature Adyen sends on Configuration and
 * Transfer webhooks (Balance Platform's "non-standard webhook" scheme,
 * where the signature lives in a header rather than embedded per-item
 * in the JSON body):
 * https://docs.adyen.com/development-resources/webhooks/secure-webhooks/verify-hmac-signatures
 *
 * Algorithm: HMAC-SHA256 of the *raw, untouched* request body (not the
 * parsed-and-restringified JSON — whitespace/key-order differences
 * would change the hash), using the hex-decoded HMAC key, base64
 * output, compared against the `hmacsignature` header.
 *
 * IMPORTANT: verify this against a real test notification (Customer
 * Area lets you send one per webhook) before relying on this in
 * production — transcribed from Adyen's docs, not yet confirmed
 * against a live payload from this app's own webhooks.
 */
export function verifyHeaderHmac(rawBody: string, signatureHeader: string | null, hmacKey: string): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", Buffer.from(hmacKey, "hex")).update(rawBody, "utf8").digest("base64");
  return signaturesMatch(expected, signatureHeader);
}

/**
 * Escapes a field value per Adyen's classic-notification HMAC spec
 * before it's joined into the colon-delimited payload below: backslash
 * first (so the escaping backslash itself doesn't get re-escaped), then
 * colon — otherwise a literal ":" or "\" inside e.g. merchantReference
 * would be indistinguishable from a field delimiter.
 */
function escapeHmacField(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}

/** The subset of a classic NotificationRequestItem that HMAC signing covers. */
export type ClassicNotificationItem = {
  pspReference?: string;
  originalReference?: string;
  merchantAccountCode?: string;
  merchantReference?: string;
  amount?: { value?: number | string; currency?: string };
  eventCode?: string;
  success?: string | boolean;
  additionalData?: { hmacSignature?: string };
};

/**
 * Verifies the HMAC-SHA256 signature on a single classic Standard/Payment
 * webhook notification item — the *other* Adyen signing scheme, used
 * only for Payment webhooks (Configuration/Transfer webhooks use
 * verifyHeaderHmac above instead):
 * https://docs.adyen.com/development-resources/webhooks/secure-webhooks/verify-hmac-signatures
 *
 * Algorithm: concatenate pspReference : originalReference :
 * merchantAccountCode : merchantReference : amount.value : amount.currency
 * : eventCode : success (empty string for any missing field, each value
 * escaped per escapeHmacField above), HMAC-SHA256 with the hex-decoded
 * key, base64-encode, compare to additionalData.hmacSignature.
 *
 * Each item in a batched notification is signed independently — verify
 * every item, don't assume one signature covers the whole batch.
 */
export function verifyClassicItemHmac(item: ClassicNotificationItem, hmacKey: string): boolean {
  const signature = item.additionalData?.hmacSignature;
  if (!signature) return false;

  const fields = [
    item.pspReference,
    item.originalReference,
    item.merchantAccountCode,
    item.merchantReference,
    item.amount?.value,
    item.amount?.currency,
    item.eventCode,
    item.success,
  ];

  const payload = fields.map((field) => escapeHmacField(field === undefined || field === null ? "" : String(field))).join(":");

  const expected = createHmac("sha256", Buffer.from(hmacKey, "hex")).update(payload, "utf8").digest("base64");
  return signaturesMatch(expected, signature);
}

/** sha256 hex digest of the raw body — dedupe key for webhooks whose
 * envelope carries no documented unique notification id (see
 * src/lib/adyen/webhooks/configuration.ts and transfers.ts). */
export function hashRawBody(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}
