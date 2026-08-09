import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus, firstIncompleteStep } from "@/lib/onboarding";

/** /onboarding has no content of its own — bounce to the right step. */
export default async function TeamOnboardingIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const status = await getOnboardingStatus(supabase, user.id);
  const next = firstIncompleteStep(status);
  redirect(next ? `/onboarding/${next}` : "/dashboard");
}
