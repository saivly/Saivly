/**
 * Company details shown in the Terms of Service and Privacy Policy.
 * TODO: fill in the real registration details before going live, and have
 * a lawyer review both documents.
 */
export const LEGAL = {
  entity: "Saivly B.V.",
  kvk: "[KvK number]",
  address: "[Registered address, Netherlands]",
  email: "support@saivly.com",
  lastUpdated: "30 October 2026",
} as const;

/**
 * Only allow same-site paths as a "back" target, so ?back= can't be used to
 * send people to another website.
 */
export function safeBackPath(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/";
  }
  return raw;
}
