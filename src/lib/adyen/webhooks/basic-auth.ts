import { timingSafeEqual } from "node:crypto";
import type { AdyenWebhookBasicAuthCredentials } from "@/lib/adyen/config";

/**
 * Constant-time string compare — same rationale as signaturesMatch in
 * ./hmac: check the length first so differing-length inputs fail that
 * check rather than throwing out of timingSafeEqual, which requires
 * equal-length buffers.
 */
function stringsMatch(expected: string, actual: string): boolean {
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(actual, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Verifies the HTTP Basic auth Adyen sends on webhook requests when a
 * "User name"/"Password" are configured for that webhook's Server
 * configuration in the Customer Area:
 * https://docs.adyen.com/development-resources/webhooks/verify-manually/#step-1-verify-the-origin
 *
 * This is a second, independent layer on top of HMAC signing
 * (verifyHeaderHmac / verifyClassicItemHmac in ./hmac) — Adyen
 * recommends combining both rather than relying on either alone.
 */
export function verifyBasicAuth(authHeader: string | null, credentials: AdyenWebhookBasicAuthCredentials): boolean {
  if (!authHeader?.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(authHeader.slice("Basic ".length), "base64").toString("utf8");
  } catch {
    return false;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return false;

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  // Check both regardless of the first result, so a wrong username
  // doesn't short-circuit before the password comparison — that timing
  // difference would leak which half was wrong.
  const usernameOk = stringsMatch(credentials.username, username);
  const passwordOk = stringsMatch(credentials.password, password);
  return usernameOk && passwordOk;
}
