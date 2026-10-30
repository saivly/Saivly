"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOrgContext } from "@/lib/dashboard/org";
import { PLAN_ORDER, type Plan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

/**
 * Settings writes are owner-only. Checked here for a clear message; the
 * api_keys table also enforces it in RLS (is_org_owner). The
 * organisations update policy only requires membership, so the owner
 * check below is what guards those columns.
 */
async function requireOwner(orgId: string) {
  const ctx = await getOrgContext(orgId);
  if (!ctx) return { error: "Organisation not found." } as const;
  if (!ctx.isOwner) return { error: "Only organisation owners can change settings." } as const;
  return { ctx } as const;
}

const SECURITY_SETTINGS = ["large_payment_alerts_enabled"] as const;

export async function setSecuritySetting(
  orgId: string,
  setting: (typeof SECURITY_SETTINGS)[number],
  enabled: boolean
): Promise<{ error?: string }> {
  if (!SECURITY_SETTINGS.includes(setting) || typeof enabled !== "boolean") return { error: "Invalid input." };
  const owner = await requireOwner(orgId);
  if ("error" in owner) return { error: owner.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organisations")
    .update({ large_payment_alerts_enabled: enabled })
    .eq("id", orgId);
  if (error) return { error: "Couldn't save. Try again." };

  revalidatePath(`/org/${orgId}/settings`);
  return {};
}

/**
 * Moves the organisation to a higher plan. Upgrades only — a downgrade
 * could leave more bank accounts open than the new plan allows. There's
 * no payment provider yet, so this only records the plan (same as the
 * onboarding plan picker); billing follows the existing billing interval.
 */
export async function upgradePlan(orgId: string, plan: Plan): Promise<{ error?: string }> {
  if (!PLAN_ORDER.includes(plan)) return { error: "Invalid input." };
  const owner = await requireOwner(orgId);
  if ("error" in owner) return { error: owner.error };

  const current = owner.ctx.organisation.plan ?? "starter";
  if (PLAN_ORDER.indexOf(plan) <= PLAN_ORDER.indexOf(current)) {
    return { error: "You can only upgrade to a higher plan." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("organisations").update({ plan }).eq("id", orgId);
  if (error) return { error: "Couldn't change your plan. Try again." };

  revalidatePath(`/org/${orgId}`, "layout");
  return {};
}

const KeySchema = z.object({
  orgId: z.uuid(),
  name: z.string().trim().min(1, "Give the key a name.").max(60, "Use at most 60 characters."),
  environment: z.enum(["live", "test"]),
});

export type ApiKeyState = { error?: string; key?: string };

/**
 * Creates an API key. Only a sha256 hash and the last four characters
 * are stored; the full key is returned once for the user to copy.
 */
export async function createApiKey(_prev: ApiKeyState, formData: FormData): Promise<ApiKeyState> {
  const parsed = KeySchema.safeParse({
    orgId: formData.get("orgId"),
    name: formData.get("name"),
    environment: formData.get("environment"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { orgId, name, environment } = parsed.data;
  const owner = await requireOwner(orgId);
  if ("error" in owner) return { error: owner.error };

  const prefix = `sv_${environment}_`;
  const secret = randomBytes(24).toString("base64url");
  const key = `${prefix}${secret}`;

  const supabase = await createClient();
  const { error } = await supabase.from("api_keys").insert({
    organisation_id: orgId,
    name,
    environment,
    key_prefix: prefix,
    last_four: secret.slice(-4),
    key_hash: createHash("sha256").update(key).digest("hex"),
  });
  if (error) return { error: "Couldn't create the key. Try again." };

  revalidatePath(`/org/${orgId}/settings`);
  return { key };
}

export async function revokeApiKey(orgId: string, keyId: string): Promise<{ error?: string }> {
  const owner = await requireOwner(orgId);
  if ("error" in owner) return { error: owner.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("organisation_id", orgId)
    .is("revoked_at", null);
  if (error) return { error: "Couldn't revoke the key. Try again." };

  revalidatePath(`/org/${orgId}/settings`);
  return {};
}
