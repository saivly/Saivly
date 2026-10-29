import { notFound } from "next/navigation";
import { Card, CardTitle, Field, PageHeader, inputStyles } from "@/components/dashboard/ui";
import { formatFullDateTime } from "@/lib/dashboard/format";
import { getOrgContext } from "@/lib/dashboard/org";
import { getLocale, getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import ApiKeys, { type ApiKeyItem } from "./api-keys";
import OrganisationForm from "./organisation-form";
import PasskeyManager from "./passkey-manager";
import SecuritySettings from "./security-settings";

export default async function SettingsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const [ctx, t, locale] = await Promise.all([getOrgContext(orgId), getT(), getLocale()]);
  if (!ctx) notFound();
  const { organisation, isOwner } = ctx;

  const supabase = await createClient();
  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, name, environment, key_prefix, last_four, created_at, last_used_at")
    .eq("organisation_id", orgId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  const keyItems: ApiKeyItem[] = (keys ?? []).map((k) => ({
    id: k.id,
    name: k.name,
    masked: `${k.key_prefix}••••${k.last_four}`,
    lastUsed: k.last_used_at
      ? t("Last used {date}", { date: formatFullDateTime(k.last_used_at, locale) })
      : t("Never used · created {date}", { date: formatFullDateTime(k.created_at, locale) }),
  }));

  return (
    <>
      <PageHeader title={t("Settings")} subtitle={t("Manage your organisation, API access and security.")} />

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
            <OrganisationForm orgId={orgId} currency={organisation.default_currency} disabled={!isOwner} />
            {organisation.kvk_number && (
              <Field label={t("KVK number")}>
                <input value={organisation.kvk_number} disabled readOnly className={`${inputStyles} font-mono`} />
              </Field>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>{t("API keys")}</CardTitle>
          <ApiKeys orgId={orgId} keys={keyItems} disabled={!isOwner} />
        </Card>

        <Card>
          <CardTitle>{t("Security")}</CardTitle>
          <SecuritySettings
            orgId={orgId}
            ipAllowlist={organisation.ip_allowlist_enabled}
            largePaymentAlerts={organisation.large_payment_alerts_enabled}
            disabled={!isOwner}
          />
        </Card>

        <PasskeyManager />
      </div>
    </>
  );
}
