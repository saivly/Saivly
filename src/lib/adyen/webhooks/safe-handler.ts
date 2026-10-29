import { NextResponse } from "next/server";

/**
 * Wraps a webhook route handler so an unexpected throw (missing env var,
 * Supabase unreachable, ...) is logged with its cause and answered with
 * a short reason. Without this, Next.js returns an empty 500 and neither
 * Adyen's delivery log nor the server logs say what went wrong.
 * Still a 500, so Adyen keeps retrying.
 */
export function safeWebhookHandler(
  name: string,
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      return await handler(request);
    } catch (err) {
      console.error(`[adyen:webhooks:${name}] unhandled error:`, err);
      const reason = err instanceof Error ? err.message : String(err);
      return new NextResponse(`internal error: ${reason}`, { status: 500 });
    }
  };
}
