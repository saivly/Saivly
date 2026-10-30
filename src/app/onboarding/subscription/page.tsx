import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/onboarding/onboarding";
import { saveSubscription } from "./actions";
import PlanPicker from "./plan-picker";
import { getT } from "@/lib/i18n-server";
import { PLAN_OPTIONS, BILLING_INTERVALS } from "@/lib/zod";

export default async function SubscriptionStep({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; plan?: string; interval?: string }>;
}) {
  const { error, plan, interval } = await searchParams;
  // Set when coming back from /terms or /privacy, so the choice made before
  // leaving is kept. Ignored unless it is a known value.
  const returnedPlan = PLAN_OPTIONS.find((p) => p === plan) ?? null;
  const returnedInterval = BILLING_INTERVALS.find((i) => i === interval) ?? null;
  const t = await getT();

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

  const { data: existing } = membership
    ? await supabase
        .from("organisations")
        .select("plan, billing_interval")
        .eq("id", membership.organisation_id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] leading-tight font-bold">
          {t("Choose the plan that fits your business")}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {t("Step 4 of 4 — you can change your plan anytime from your dashboard.")}
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {t(error)}
        </p>
      )}

      <PlanPicker
        action={saveSubscription}
        initialPlan={returnedPlan ?? existing?.plan ?? null}
        initialInterval={returnedInterval ?? existing?.billing_interval ?? null}
      />
    </div>
  );
}
