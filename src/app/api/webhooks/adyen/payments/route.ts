import { after, NextResponse } from "next/server";
import { adyenWebhookBasicAuth, adyenWebhookHmacKey } from "@/lib/adyen/config";
import { verifyBasicAuth } from "@/lib/adyen/webhooks/basic-auth";
import type { ClassicNotificationItem } from "@/lib/adyen/webhooks/hmac";
import {
  parsePaymentWebhookBody,
  processPaymentWebhookEvent,
  storePaymentWebhookEvent,
  verifyAllItems,
} from "@/lib/adyen/webhooks/payments";

/**
 * Adyen Standard/Payment webhooks (AUTHORISATION, CAPTURE, REFUND, ...).
 * Configure this URL as the "Standard notification" webhook's Server
 * configuration URL in the Customer Area, one per environment, with a
 * "User name"/"Password" set there too (checked below, on top of the
 * per-item HMAC signatures — see the module doc on verifyBasicAuth).
 *
 * Unlike Configuration/Transfer webhooks, one HTTP POST can batch
 * several notification items — each is verified and stored
 * individually, and this responds "[accepted]" once every item in the
 * batch is durably stored (or already was, on redelivery), same as the
 * other two routes: verify -> store -> ack -> process, without
 * business logic in the response path.
 */
export async function POST(request: Request) {
  const hmacKey = adyenWebhookHmacKey("payments");
  if (!hmacKey) {
    console.error("[adyen:webhooks:payments] HMAC key not set — rejecting notification.");
    return new NextResponse("not configured", { status: 500 });
  }

  const basicAuthCredentials = adyenWebhookBasicAuth("payments");
  if (!basicAuthCredentials) {
    console.error("[adyen:webhooks:payments] basic auth credentials not set — rejecting notification.");
    return new NextResponse("not configured", { status: 500 });
  }
  if (!verifyBasicAuth(request.headers.get("authorization"), basicAuthCredentials)) {
    console.error("[adyen:webhooks:payments] basic auth failed — rejecting notification.");
    return new NextResponse("unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="adyen-webhooks"' },
    });
  }

  const rawBody = await request.text();
  const body = parsePaymentWebhookBody(rawBody);
  if (!body) {
    console.error("[adyen:webhooks:payments] couldn't parse notification body:", rawBody);
    return new NextResponse("malformed body", { status: 400 });
  }

  // Every item is signed independently (see verifyAllItems) — one bad
  // signature fails the whole batch rather than partially trusting it.
  if (!verifyAllItems(body, hmacKey)) {
    console.error("[adyen:webhooks:payments] signature verification failed — rejecting notification.");
    return new NextResponse("invalid signature", { status: 401 });
  }

  const live = body.live === "true";
  const toProcess: { id: string; item: ClassicNotificationItem }[] = [];

  for (const { NotificationRequestItem: item } of body.notificationItems) {
    const stored = await storePaymentWebhookEvent(item, live);

    if (stored.outcome === "error") {
      // Couldn't even persist this item — the one case worth a non-2xx,
      // so Adyen retries the whole batch instead of an item being
      // silently lost. Earlier items in this loop are already stored
      // and deduped on redelivery, so the retry is harmless.
      console.error("[adyen:webhooks:payments] failed to store notification item:", stored.error);
      return new NextResponse("storage failed", { status: 500 });
    }
    if (stored.outcome === "stored") toProcess.push({ id: stored.id, item });
  }

  // `after` runs processing once the response has been sent, without
  // holding Adyen up for it — but (unlike a bare fire-and-forget) still
  // keeps the serverless function alive until it finishes.
  if (toProcess.length > 0) {
    after(async () => {
      for (const { id, item } of toProcess) {
        await processPaymentWebhookEvent(id, item);
      }
    });
  }

  return new NextResponse("[accepted]", { status: 200 });
}
