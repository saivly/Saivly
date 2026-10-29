import { after, NextResponse } from "next/server";
import { safeWebhookHandler } from "@/lib/adyen/webhooks/safe-handler";
import { adyenWebhookBasicAuth, adyenWebhookHmacKey } from "@/lib/adyen/config";
import { verifyBasicAuth } from "@/lib/adyen/webhooks/basic-auth";
import { verifyHeaderHmac } from "@/lib/adyen/webhooks/hmac";
import {
  parseTransferWebhookBody,
  processTransferWebhookEvent,
  storeTransferWebhookEvent,
} from "@/lib/adyen/webhooks/transfers";

/**
 * Adyen Transfer webhooks — transfer.created / transfer.updated events
 * (money actually moving on a balance account). Configure this URL as
 * the "Transfer" webhook's Server configuration URL in the Customer
 * Area, one per environment, with a "User name"/"Password" set there
 * too (checked below, on top of the header HMAC signature). Same
 * envelope + header-HMAC scheme as Configuration webhooks, but its own
 * Customer Area subscription + key.
 *
 * Deliberately minimal: verify -> store -> ack -> process. See the
 * module doc on processTransferWebhookEvent for why processing is split
 * out from the response.
 */
async function handle(request: Request): Promise<Response> {
  const hmacKey = adyenWebhookHmacKey("transfers");
  if (!hmacKey) {
    console.error("[adyen:webhooks:transfers] HMAC key not set — rejecting notification.");
    return new NextResponse("not configured", { status: 500 });
  }

  const basicAuthCredentials = adyenWebhookBasicAuth("transfers");
  if (!basicAuthCredentials) {
    console.error("[adyen:webhooks:transfers] basic auth credentials not set — rejecting notification.");
    return new NextResponse("not configured", { status: 500 });
  }
  if (!verifyBasicAuth(request.headers.get("authorization"), basicAuthCredentials)) {
    console.error("[adyen:webhooks:transfers] basic auth failed — rejecting notification.");
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
    console.error("[adyen:webhooks:transfers] signature verification failed — rejecting notification.");
    return new NextResponse("invalid signature", { status: 401 });
  }

  const body = parseTransferWebhookBody(rawBody);
  if (!body) {
    console.error("[adyen:webhooks:transfers] couldn't parse notification body:", rawBody);
    return new NextResponse("malformed body", { status: 400 });
  }

  const stored = await storeTransferWebhookEvent(body, rawBody);

  if (stored.outcome === "error") {
    console.error("[adyen:webhooks:transfers] failed to store notification:", stored.error);
    return new NextResponse("storage failed", { status: 500 });
  }

  if (stored.outcome === "stored") {
    after(() => processTransferWebhookEvent(stored.id, body));
  }

  return new NextResponse("[accepted]", { status: 200 });
}

export const POST = safeWebhookHandler("transfers", handle);
