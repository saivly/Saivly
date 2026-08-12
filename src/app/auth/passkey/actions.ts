"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Marks the one-time passkey prompt as seen — called on "Skip" and after
 * a successful `registerPasskey()` alike, since either way the user has
 * now been shown it. Not "completed": there's no requirement they end up
 * with a passkey, only that they were asked once. See
 * hasSeenPasskeyPrompt() in @/lib/onboarding for the read side.
 *
 * Returns whether the write actually landed. The caller (page.tsx's
 * skip()) uses this to avoid proceeding to /onboarding on a failed write
 * — the proxy re-checks passkey_prompt_seen_at on every request, so a
 * silently-swallowed failure here used to mean "Skip" would bounce the
 * user right back to this same page with no visible error at all.
 */
export async function markPasskeyPromptSeen(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from("profiles")
    .update({ passkey_prompt_seen_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("[passkey] failed to mark prompt seen:", error.message);
    return false;
  }
  return true;
}
