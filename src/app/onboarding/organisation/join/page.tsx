import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/onboarding/onboarding";
import { getT } from "@/lib/i18n-server";

/**
 * Joining an existing organisation isn't wired up yet (see ./actions.ts
 * for the dormant join_organisation() RPC flow this used to expose) — this
 * screen just explains that and sends the user back to the create-vs-join
 * fork instead of showing the (currently non-functional) join form.
 */
export default async function JoinOrganisationStep() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const status = await getOnboardingStatus(supabase, user.id);
  if (!status.personalDone) redirect("/onboarding/personal");
  if (status.organisationDone) redirect("/onboarding");
  const t = await getT();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("Joining an organisation isn't available yet")}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {t("We're still building this. In the meantime, please contact your organisation's admin and ask them to add you directly.")}
        </p>
      </div>

      <Link
        href="/onboarding/organisation"
        className="self-start rounded-lg border border-line px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface"
      >
        ← {t("Back")}
      </Link>
    </div>
  );
}
