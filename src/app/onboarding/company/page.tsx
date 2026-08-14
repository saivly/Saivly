import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/onboarding/onboarding";
import CompanyForm from "./company-form";

export default async function CompanyInfoStep({
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
  // Deliberately no organisationDone guard here, unlike the other steps:
  // reaching this page with organisationDone still false is the expected
  // "create new" path (see /onboarding/organisation) — submitting this
  // very form is what flips it true, by creating the org + membership row.

  const { data: membership } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const { data: existing } = membership
    ? await supabase
        .from("organisations")
        .select(
          "id, country, relationship_type, kvk_number, name, street, postal_code, city"
        )
        .eq("id", membership.organisation_id)
        .maybeSingle()
    : { data: null };

  // Never sends the key itself — just whether we're falling back to KVK's
  // public sandbox because KVK_API_KEY isn't set. See src/lib/kvk.ts.
  const usingTestData = !process.env.KVK_API_KEY && process.env.NODE_ENV !== "production";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Company information
        </h1>
        <p className="mt-2 text-sm text-muted">
          Step 2 of 4 — tell us about the business you&apos;re setting up.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <CompanyForm
        existing={{
          companyCountry: existing?.country ?? "NL",
          relationshipType: existing?.relationship_type ?? "",
          kvkNumber: existing?.kvk_number ?? "",
          companyName: existing?.name ?? "",
          companyStreet: existing?.street ?? "",
          companyPostalCode: existing?.postal_code ?? "",
          companyCity: existing?.city ?? "",
        }}
        usingTestData={usingTestData}
        organisationId={existing?.id ?? null}
      />
    </div>
  );
}
