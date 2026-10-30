import { redirect } from "next/navigation";
import { markVerifiedIfReady } from "@/lib/adyen/verification";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/dashboard/ui";
import { startReverification } from "./actions";
import AutoRefresh from "./auto-refresh";

export const dynamic = "force-dynamic";

/**
 * Shown after the last onboarding step until Adyen has approved every
 * capability (the proxy sends unverified orgs here — see step 6 in
 * @/lib/supabase/proxy). Each render asks Adyen; the configuration
 * webhook does the same in the background. Once verified, the org never
 * sees this page again.
 */
export default async function VerifyingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const state = await markVerifiedIfReady(membership.organisation_id);
  if (state === "verified") redirect("/dashboard");

  const t = await getT();

  if (state === "action_needed") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 text-center">
        {/* Keeps checking: once the fix is accepted this flips back to the waiting view. */}
        <AutoRefresh seconds={30} />

        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger/10" aria-hidden="true">
          <Icon name="error" size={32} className="text-danger" />
        </span>

        <div>
          <h1 className="text-[28px] leading-tight font-bold">{t("Adyen needs a bit more information")}</h1>
          <p className="mt-2 text-sm text-muted">
            {t(
              "Some of your details couldn't be verified or are missing. Go through Adyen's verification again to fix them — it only asks for what's still needed."
            )}
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{t(error)}</p>
        )}

        <form action={startReverification}>
          <button className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent hover:bg-db-primary-hover">
            {t("Complete verification with Adyen")}
          </button>
        </form>

        <form action="/auth/signout" method="post" className="self-center">
          <button className="text-sm text-muted hover:underline">{t("Log out")}</button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 text-center">
      <AutoRefresh seconds={20} />

      <div className="relative mx-auto flex h-16 w-16 items-center justify-center" aria-hidden="true">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
          <Icon name="verified_user" size={32} className="text-accent" />
        </span>
      </div>

      <div>
        <h1 className="text-[28px] leading-tight font-bold">{t("We're verifying your details")}</h1>
        <p className="mt-2 text-sm text-muted">
          {t(
            "We're checking all your information with our partner Adyen. This can take up to 1 business day, but is often much faster."
          )}
        </p>
      </div>

      <ul className="mx-auto flex flex-col gap-2 text-left text-sm">
        <li className="flex items-start gap-2">
          <Icon name="check_circle" className="text-accent" />
          {t("Your onboarding is complete")}
        </li>
        <li className="flex items-start gap-2">
          <Icon name="progress_activity" className="animate-spin text-muted [animation-duration:2.5s]" />
          {t("Adyen is verifying your organisation")}
        </li>
        <li className="flex items-start gap-2">
          <Icon name="mail" className="text-muted" />
          {t("We'll email you as soon as everything is ready")}
        </li>
      </ul>

      <p className="text-[13px] text-muted">
        {t("You can close this page. It updates on its own when you're approved.")}
      </p>

      <form action="/auth/signout" method="post" className="self-center">
        <button className="text-sm text-muted hover:underline">{t("Log out")}</button>
      </form>
    </main>
  );
}
