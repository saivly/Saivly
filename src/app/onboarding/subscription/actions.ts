"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/onboarding";
import { subscriptionSchema } from "@/lib/zod";

export async function saveSubscription(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const status = await getOnboardingStatus(supabase, user.id);
  if (!status.personalDone) redirect("/onboarding/personal");
  if (!status.companyDone) redirect("/onboarding/company");
  if (!status.adyenDone) redirect("/onboarding/adyen");

  const { data: membership } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  // status.companyDone already implies membership exists, but don't trust
  // that without checking — this is the write path, not just a redirect.
  if (!membership) redirect("/onboarding/company");

  const parsed = subscriptionSchema.safeParse({
    plan: formData.get("plan") as string,
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Choose a plan.";
    redirect(`/onboarding/subscription?error=${encodeURIComponent(message)}`);
  }

  const { error } = await supabase
    .from("organisations")
    .update({
      plan: parsed.data.plan,
      subscription_completed_at: new Date().toISOString(),
    })
    .eq("id", membership.organisation_id);

  if (error) {
    redirect(
      `/onboarding/subscription?error=${encodeURIComponent(error.message)}`
    );
  }

  // Last step — onboarding is now fully complete, proxy sends anything
  // under /onboarding to /dashboard from here on anyway.
  redirect("/dashboard");
}
