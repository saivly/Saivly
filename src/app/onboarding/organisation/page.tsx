import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus, firstIncompleteStep } from "@/lib/onboarding";

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <rect x="5" y="3" width="14" height="18" rx="1" strokeLinejoin="round" />
      <path d="M9 7h1M14 7h1M9 11h1M14 11h1" strokeLinecap="round" />
      <path d="M10 21v-4h4v4" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14.2c2.4.2 4.3 2.1 4.6 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CHOICES = [
  {
    href: "/onboarding/company",
    icon: BuildingIcon,
    title: "Yes, I want to create a new organisation",
    body: "Set up your company details and subscription from scratch — you'll be its owner.",
  },
  {
    href: "/onboarding/organisation/join",
    icon: UsersIcon,
    title: "No, I want to join an existing organisation",
    body: "Enter your organisation's name and ID to join a team that's already set up.",
  },
] as const;

/**
 * The create-vs-join fork — see ONBOARDING_STEPS in @/lib/onboarding.
 * Unlike the personal/company/subscription steps, there's no form here to
 * revisit: once organisationDone flips true (either path sets it, via
 * organisation_members), landing back on this URL just bounces onward.
 */
export default async function OrganisationChoiceStep() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const status = await getOnboardingStatus(supabase, user.id);
  if (!status.personalDone) redirect("/onboarding/personal");
  if (status.organisationDone) {
    const next = firstIncompleteStep(status);
    redirect(next ? `/onboarding/${next}` : "/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Do you want to create a new organisation?
        </h1>
        <p className="mt-2 text-sm text-muted">
          Step 2 of 4 — every account belongs to an organisation. Start one,
          or join a teammate&apos;s.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {CHOICES.map(({ href, icon: Icon, title, body }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-4 rounded-xl border border-line p-4 transition-colors hover:border-ink hover:bg-accent-soft"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink text-white">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
