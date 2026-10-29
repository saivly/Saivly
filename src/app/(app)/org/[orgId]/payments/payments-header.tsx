import { PageHeader, SegmentLink, Segmented } from "@/components/dashboard/ui";
import type { T } from "@/lib/i18n";

export default function PaymentsHeader({ orgId, view, t }: { orgId: string; view: "payments" | "payouts"; t: T }) {
  return (
    <PageHeader
      title={t("Payments & payouts")}
      subtitle={t("Track incoming payments and payouts to your bank account.")}
      actions={
        <Segmented>
          <SegmentLink href={`/org/${orgId}/payments`} active={view === "payments"} size="lg" icon="south_west">
            {t("Incoming payments")}
          </SegmentLink>
          <SegmentLink href={`/org/${orgId}/payments/payouts`} active={view === "payouts"} size="lg" icon="north_east">
            {t("Payouts")}
          </SegmentLink>
        </Segmented>
      }
    />
  );
}
