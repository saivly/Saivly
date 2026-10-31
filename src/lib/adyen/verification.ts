import { onboardingCompleteEmail, sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensurePrimaryBankAccount } from "./bank-accounts";
import { adyenRequest } from "./client";
import { checkAdyenVerificationStatus } from "./legalEntity";

/**
 * The gate between finishing onboarding and using the dashboard: an org
 * is "verified" once Adyen reports every requested capability on its
 * account holder as valid. That moment is recorded once in
 * organisations.adyen_verified_at (migration 0022) and never undone.
 */

type Capability = { requested?: boolean; allowed?: boolean; enabled?: boolean; verificationStatus?: string };
type AccountHolderResponse = { capabilities?: Record<string, Capability> };

/**
 * Where the org stands with Adyen:
 *  - "verified": every requested capability is allowed, enabled and valid
 *  - "pending": Adyen is still reviewing — nothing for the shopper to do
 *  - "action_needed": something is invalid, rejected or missing, so the
 *    shopper has to go through Adyen's hosted onboarding again
 */
export type VerificationState = "verified" | "pending" | "action_needed";

type CapabilityState = "valid" | "pending" | "action_needed" | null;

async function capabilityState(accountHolderId: string): Promise<CapabilityState> {
  const result = await adyenRequest<AccountHolderResponse>(
    "balancePlatform",
    `/accountHolders/${encodeURIComponent(accountHolderId)}`
  );
  if (!result.ok) return null;
  // Capabilities turned off on purpose (requested: false) don't count.
  const requested = Object.values(result.data.capabilities ?? {}).filter((c) => c.requested !== false);
  if (requested.length === 0) return "pending";
  if (requested.some((c) => c.verificationStatus === "invalid" || c.verificationStatus === "rejected")) {
    return "action_needed";
  }
  return requested.every((c) => c.allowed && c.enabled && c.verificationStatus === "valid") ? "valid" : "pending";
}

/**
 * Checks Adyen and, the first time everything is valid, marks the org as
 * verified, emails its owners and issues the primary IBAN. Once verified
 * (now or earlier) it always returns "verified" without asking Adyen
 * again. Safe to call often and concurrently: only the caller that flips
 * the flag sends the email.
 */
export async function markVerifiedIfReady(organisationId: string): Promise<VerificationState> {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organisations")
    .select("name, adyen_account_holder_id, adyen_organization_legal_entity_id, adyen_verified_at")
    .eq("id", organisationId)
    .maybeSingle();
  if (!org) return "pending";
  if (org.adyen_verified_at) return "verified";
  if (!org.adyen_account_holder_id) return "pending";

  const [capabilities, legalEntity] = await Promise.all([
    capabilityState(org.adyen_account_holder_id),
    // Missing or rejected details on the org or its people show up here,
    // often before any capability turns invalid.
    org.adyen_organization_legal_entity_id
      ? checkAdyenVerificationStatus(org.adyen_organization_legal_entity_id)
      : Promise.resolve(null),
  ]);
  if (capabilities !== "valid") {
    return capabilities === "action_needed" || legalEntity === "incomplete" ? "action_needed" : "pending";
  }

  const { data: flipped } = await admin
    .from("organisations")
    .update({ adyen_verified_at: new Date().toISOString() })
    .eq("id", organisationId)
    .is("adyen_verified_at", null)
    .select("id")
    .maybeSingle();
  if (!flipped) return "verified"; // someone else got there first and handles the rest

  await Promise.all([
    ensurePrimaryBankAccount(organisationId).catch((err) =>
      console.error(`[verification] primary bank account for org ${organisationId} failed:`, err)
    ),
    emailOwners(admin, organisationId, org.name),
  ]);
  return "verified";
}

/** One email per owner, so each greeting uses their own first name. */
async function emailOwners(admin: ReturnType<typeof createAdminClient>, organisationId: string, orgName: string) {
  const { data: owners } = await admin
    .from("organisation_members")
    .select("user_id")
    .eq("organisation_id", organisationId)
    .eq("role", "owner");
  const ownerIds = (owners ?? []).map((o) => o.user_id);
  if (ownerIds.length === 0) return;

  const { data: profiles } = await admin.from("profiles").select("id, first_name").in("id", ownerIds);
  const firstNames = new Map((profiles ?? []).map((p) => [p.id, p.first_name]));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://banking.saivly.com";

  await Promise.all(
    ownerIds.map(async (userId) => {
      const email = (await admin.auth.admin.getUserById(userId)).data.user?.email;
      if (!email) return;
      const sent = await sendEmail({
        to: [email],
        ...onboardingCompleteEmail({
          firstName: firstNames.get(userId) ?? null,
          orgName,
          dashboardUrl: `${siteUrl}/dashboard`,
        }),
      });
      if (!sent) console.error(`[verification] "onboarding complete" email to owner ${userId} (org ${organisationId}) not sent.`);
    })
  );
}
