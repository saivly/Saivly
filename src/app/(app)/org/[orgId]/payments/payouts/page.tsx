import { redirect } from "next/navigation";

/** Payouts are now part of Transactions; old links land on its payouts filter. */
export default async function PayoutsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  redirect(`/org/${orgId}/payments?type=payouts`);
}
