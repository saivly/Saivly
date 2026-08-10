"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Marks the one-time passkey prompt as seen — called on "Skip" and after
 * a successful `registerPasskey()` alike, since either way the user has
 * now been shown it. Not "completed": there's no requirement they end up
 * with a passkey, only that they were asked once. See
 * hasSeenPasskeyPrompt() in @/lib/onboarding for the read side.
 */
export async function markPasskeyPromptSeen() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ passkey_prompt_seen_at: new Date().toISOString() })
    .eq("id", user.id);
}
