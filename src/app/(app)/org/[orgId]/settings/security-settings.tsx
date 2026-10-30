"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useT } from "@/app/i18n-provider";
import { ToggleVisual } from "@/components/dashboard/ui";
import { createClient } from "@/lib/supabase/client";
import { setSecuritySetting } from "./actions";

function Row({
  title,
  description,
  on,
  disabled,
  onToggle,
}: {
  title: string;
  description: string;
  on: boolean | null;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-db-row py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-medium text-db-ink">{title}</p>
        <p className="text-[13px] text-db-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on ?? false}
        aria-label={title}
        disabled={disabled || on === null}
        onClick={onToggle}
        className="rounded-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ToggleVisual on={on ?? false} />
      </button>
    </div>
  );
}

/**
 * Two-factor authentication is per user (a Supabase TOTP factor) and is
 * read live; large payment alerts is an organisation setting in the database.
 */
export default function SecuritySettings({
  orgId,
  largePaymentAlerts,
  disabled,
}: {
  orgId: string;
  largePaymentAlerts: boolean;
  disabled: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [mfa, setMfa] = useState<{ on: boolean; factorId?: string } | null>(null);
  const [alerts, setAlerts] = useState(largePaymentAlerts);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.mfa.listFactors()
      .then(({ data }) => {
        const factor = data?.totp?.find((f) => f.status === "verified");
        setMfa({ on: Boolean(factor), factorId: factor?.id });
      })
      .catch(() => setMfa({ on: false }));
  }, []);

  async function toggleMfa() {
    if (!mfa) return;
    if (!mfa.on) {
      router.push("/auth/mfa/enroll");
      return;
    }
    if (!window.confirm(t("Turn off two-factor authentication? You'll confirm sign-ins with an emailed code instead."))) return;
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId: mfa.factorId! });
    if (error) {
      setError(error.message);
      return;
    }
    await supabase.auth.refreshSession();
    setMfa({ on: false });
  }

  function toggleAlerts(next: boolean) {
    setAlerts(next);
    startTransition(async () => {
      const result = await setSecuritySetting(orgId, "large_payment_alerts_enabled", next);
      if (result.error) {
        setAlerts(!next);
        setError(t(result.error));
      } else setError(null);
    });
  }

  return (
    <div>
      <Row
        title={t("Two-factor authentication")}
        description={t("Require an authenticator app code when you sign in.")}
        on={mfa?.on ?? null}
        onToggle={toggleMfa}
      />
      <Row
        title={t("Large payment alerts")}
        description={t("Notify owners about unusually large payments.")}
        on={alerts}
        disabled={disabled || pending}
        onToggle={() => toggleAlerts(!alerts)}
      />
      {error && <p className="mt-3 text-sm text-db-danger">{error}</p>}
    </div>
  );
}
