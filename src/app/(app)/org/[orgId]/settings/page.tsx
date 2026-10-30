import { notFound } from "next/navigation";
import { Card, CardTitle, Field, PageHeader, inputStyles } from "@/components/dashboard/ui";
import { getOrgContext } from "@/lib/dashboard/org";
import { getT } from "@/lib/i18n-server";
import PasskeyManager from "./passkey-manager";
import PlanSettings from "./plan-settings";
import SecuritySettings from "./security-settings";

// API keys (./api-keys.tsx and its actions) are hidden for now; the code is
// kept so the section can come back without rebuilding it.

export default async function SettingsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const [ctx, t] = await Promise.all([getOrgContext(orgId), getT()]);
  if (!ctx) notFound();
  const { organisation, isOwner } = ctx;

  return (
    <>
      <PageHeader title={t("Settings")} subtitle={t("Manage your organisation, plan and security.")} />

      <div className="flex max-w-[720px] flex-col gap-6">
        {!isOwner && (
          <p className="rounded-lg border border-db-border bg-db-subtle px-4 py-3 text-sm text-db-muted">
            {t("Only organisation owners can change these settings.")}
          </p>
        )}

        <Card>
          <CardTitle>{t("Organisation")}</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Legal name")} hint={t("Verified with Adyen. Contact support to change it.")}>
              <input value={organisation.name} disabled readOnly className={inputStyles} />
            </Field>
            {organisation.kvk_number && (
              <Field label={t("KVK number")}>
                <input value={organisation.kvk_number} disabled readOnly className={`${inputStyles} font-mono`} />
              </Field>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>{t("Plan")}</CardTitle>
          <PlanSettings
            orgId={orgId}
            plan={organisation.plan ?? "starter"}
            interval={organisation.billing_interval ?? "monthly"}
            disabled={!isOwner}
          />
        </Card>

        <Card>
          <CardTitle>{t("Security")}</CardTitle>
          <SecuritySettings
            orgId={orgId}
            largePaymentAlerts={organisation.large_payment_alerts_enabled}
            disabled={!isOwner}
          />
        </Card>

        <PasskeyManager />
      </div>
    </>
  );
}
