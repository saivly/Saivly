/**
 * Sanitize a user-supplied ?next= redirect target.
 * Only same-origin paths survive: "https://evil.com", "//evil.com",
 * and "/\evil.com" (browser backslash-normalization) are all rejected.
 */
export function safeNext(
  next: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
  ) {
    return next;
  }
  return fallback;
}
