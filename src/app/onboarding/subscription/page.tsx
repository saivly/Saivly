import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/onboarding/onboarding";
import { PLAN_OPTIONS } from "@/lib/zod";
import { saveSubscription } from "./actions";

const PLANS: { id: (typeof PLAN_OPTIONS)[number]; name: string; description: string }[] = [
  { id: "free", name: "Free", description: "For getting started and trying things out." },
  { id: "pro", name: "Pro", description: "For growing teams that need more room to work." },
  { id: "enterprise", name: "Enterprise", description: "For larger organizations with custom needs." },
];

export default async function SubscriptionStep({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
        .select("plan")
        .eq("id", membership.organisation_id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Choose a plan
        </h1>
        <p className="mt-2 text-sm text-muted">
          Step 4 of 4 — you can change this later from your account settings.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <form action={saveSubscription} className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {PLANS.map((p) => (
            <label key={p.id} className="cursor-pointer">
              <input
                type="radio"
                name="plan"
                value={p.id}
                required
                defaultChecked={existing?.plan === p.id}
                className="peer sr-only"
              />
              <div className="h-full rounded-xl border border-line p-4 transition-colors peer-checked:border-ink peer-checked:bg-accent-soft peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                <p className="font-medium">{p.name}</p>
                <p className="mt-1 text-sm text-muted">{p.description}</p>
              </div>
            </label>
          ))}
        </div>

        <button className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">
          Finish setup
        </button>
      </form>
    </div>
  );
}
