import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/onboarding/onboarding";
import { joinOrganisation } from "./actions";

const inputClasses =
  "rounded-lg border border-line bg-panel px-3 py-2.5 text-base outline-none transition-colors focus:border-ink sm:text-sm";

export default async function JoinOrganisationStep({
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
  if (status.organisationDone) redirect("/onboarding");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Join an existing organisation
        </h1>
        <p className="mt-2 text-sm text-muted">
          Step 2 of 4 — ask whoever set up your organisation for its exact
          name and ID. They can find the ID on their own company step.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <form action={joinOrganisation} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          Organisation name
          <input
            type="text"
            name="organisationName"
            required
            autoFocus
            placeholder="Acme B.V."
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Organisation ID
          <input
            type="text"
            name="organisationId"
            required
            placeholder="e.g. 5f2e1c3a-7b9d-4a1e-9c3f-8d2b6e1a0f4c"
            className={`${inputClasses} font-mono text-sm`}
          />
        </label>

        <button className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">
          Join organisation
        </button>
      </form>

      <Link
        href="/onboarding/organisation"
        className="self-start text-sm text-muted hover:underline"
      >
        ← Back
      </Link>
    </div>
  );
}
