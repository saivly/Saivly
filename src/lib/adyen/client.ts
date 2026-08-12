import { adyenConfig, type AdyenServiceName } from "./config";

export type AdyenErrorResponse = { errorCode?: string; message?: string };

export type AdyenResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_configured" }
  | { ok: false; reason: "request_failed"; status?: number; error?: AdyenErrorResponse };

/** Best-effort pretty-print of a fetch body (always a JSON string from our
 * own callers, but don't crash logging if that's ever not the case). */
function tryParseJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Shared fetch wrapper for any Adyen service: resolves that service's
 * config, sends the request with the right auth header, and normalizes
 * both transport errors and non-2xx responses into an AdyenResult so
 * callers don't each re-implement try/catch + res.ok handling.
 *
 * TEMP: logs every request and response body in full, for local
 * debugging while wiring up the org/account-holder/balance-account
 * chain — see console output. Pull this (or at least gate it behind
 * something other than "always on") once that's stable: request bodies
 * carry PII (names, addresses, KVK numbers) and don't belong in
 * long-lived logs, prod especially. Never logs the API key itself.
 */
export async function adyenRequest<T>(
  service: AdyenServiceName,
  path: string,
  init?: RequestInit
): Promise<AdyenResult<T>> {
  const config = adyenConfig(service);
  if (!config) {
    console.error(
      `[adyen:${service}] API key not set (or still the placeholder) — skipping request to ${path}.`
    );
    return { ok: false, reason: "not_configured" };
  }

  const method = init?.method ?? "GET";
  console.log(`[adyen:${service}] -> ${method} ${path}`, tryParseJson(init?.body));

  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        "X-API-Key": config.apiKey,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    // Read the body once as text, then try to parse — res.json() and
    // res.text() can't both run on the same response.
    const rawBody = await res.text().catch(() => "");
    const body = rawBody ? tryParseJson(rawBody) : null;

    console.log(`[adyen:${service}] <- ${res.status} ${method} ${path}`, body);

    if (!res.ok) {
      const error = body as AdyenErrorResponse | null;
      console.error(`[adyen:${service}] ${path} failed (${res.status}):`, error?.message ?? body);
      return { ok: false, reason: "request_failed", status: res.status, error: error ?? undefined };
    }

    return { ok: true, data: body as T };
  } catch (err) {
    console.error(`[adyen:${service}] ${path} request failed:`, err);
    return { ok: false, reason: "request_failed" };
  }
}
