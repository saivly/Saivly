import { adyenConfig, type AdyenServiceName } from "./config";

export type AdyenErrorResponse = { errorCode?: string; message?: string };

export type AdyenResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_configured" }
  | { ok: false; reason: "request_failed"; status?: number; error?: AdyenErrorResponse };

/**
 * Shared fetch wrapper for any Adyen service: resolves that service's
 * config, sends the request with the right auth header, and normalizes
 * both transport errors and non-2xx responses into an AdyenResult so
 * callers don't each re-implement try/catch + res.ok handling.
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

  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        "X-API-Key": config.apiKey,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as AdyenErrorResponse | null;
      console.error(
        `[adyen:${service}] ${path} failed (${res.status}):`,
        body?.message ?? (await res.text().catch(() => "unknown error"))
      );
      return { ok: false, reason: "request_failed", status: res.status, error: body ?? undefined };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    console.error(`[adyen:${service}] ${path} request failed:`, err);
    return { ok: false, reason: "request_failed" };
  }
}
