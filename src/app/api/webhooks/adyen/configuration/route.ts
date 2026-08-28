import { after, NextResponse } from "next/server";
import { adyenWebhookBasicAuth, adyenWebhookHmacKey } from "@/lib/adyen/config";
import { verifyBasicAuth } from "@/lib/adyen/webhooks/basic-auth";
import {
  parseConfigurationWebhookBody,
  processConfigurationWebhookEvent,
  storeConfigurationWebhookEvent,
} from "@/lib/adyen/webhooks/configuration";
import { verifyHeaderHmac } from "@/lib/adyen/webhooks/hmac";

/**
 * Adyen Configuration webhooks — legalEntity.* / accountHolder.* /
 * balanceAccount.* events from onboarding/KYC. Configure this URL as
 * the "Configuration" webhook's Server configuration URL in the
 * Customer Area, one per environment, with a "User name"/"Password" set
 * there too (checked below, on top of the header HMAC signature).
 *
 * Deliberately minimal: verify -> store -> ack -> process. Adyen
 * retries (with backoff, eventually giving up) on anything other than a
 * fast 2xx, so the response must not wait on business logic — see the
 * module doc on processConfigurationWebhookEvent for why that's split
 * out.
 */
export async function POST(request: Request) {
  const hmacKey = adyenWebhookHmacKey("configuration");
  if (!hmacKey) {
    console.error("[adyen:webhooks:configuration] HMAC key not set — rejecting notification.");
    return new NextResponse("not configured", { status: 500 });
  }

  const basicAuthCredentials = adyenWebhookBasicAuth("configuration");
  if (!basicAuthCredentials) {
    console.error("[adyen:webhooks:configuration] basic auth credentials not set — rejecting notification.");
    return new NextResponse("not configured", { status: 500 });
  }
  if (!verifyBasicAuth(request.headers.get("authorization"), basicAuthCredentials)) {
    console.error("[adyen:webhooks:configuration] basic auth failed — rejecting notification.");
    return new NextResponse("unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="adyen-webhooks"' },
    });
  }

  // Raw text, not request.json() — signature verification needs the
  // exact bytes Adyen sent, before any parsing.
  const rawBody = await request.text();
  const signature = request.headers.get("hmacsignature");

  if (!verifyHeaderHmac(rawBody, signature, hmacKey)) {
    console.error("[adyen:webhooks:configuration] signature verification failed — rejecting notification.");
    return new NextResponse("invalid signature", { status: 401 });
  }

  const body = parseConfigurationWebhookBody(rawBody);
  if (!body) {
    console.error("[adyen:webhooks:configuration] couldn't parse notification body:", rawBody);
    return new NextResponse("malformed body", { status: 400 });
  }

  const stored = await storeConfigurationWebhookEvent(body, rawBody);

  if (stored.outcome === "error") {
    // Couldn't even persist it — the one case worth a non-2xx, so Adyen
    // retries instead of the notification being silently lost.
    console.error("[adyen:webhooks:configuration] failed to store notification:", stored.error);
    return new NextResponse("storage failed", { status: 500 });
  }

  // Ack immediately once the event is durably stored (or already was —
  // "duplicate" is Adyen redelivering, not a problem). `after` runs
  // processing once the response has been sent, without holding Adyen
  // up for it — but (unlike a bare fire-and-forget) still keeps the
  // serverless function alive until it finishes, so it can't get killed
  // mid-write. A failure there updates the row's status but never turns
  // into a retry.
  if (stored.outcome === "stored") {
    after(() => processConfigurationWebhookEvent(stored.id, body));
  }

  return new NextResponse("[accepted]", { status: 200 });
}
