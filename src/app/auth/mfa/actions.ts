"use server";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeNext } from "@/lib/safe-redirect";
import {
  hitRateLimit,
  RATE_LIMIT_UNAVAILABLE_MSG,
  TOO_MANY_ATTEMPTS_MSG,
} from "@/lib/rate-limit";

const BACKUP_CODE_COUNT = 10;
// 8 chars from a 32-symbol alphabet = 40 bits — plenty for single-use
// codes behind a 5-attempts-per-hour limit.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateBackupCode() {
  const bytes = randomBytes(8);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % 32]; // 256/32 — no modulo bias
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

function hashCode(code: string) {
  const normalized = code.toUpperCase().replace(/[^A-Z2-9]/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Verify the 6-digit TOTP code for an existing factor (the per-session
 * AAL2 challenge). Runs server-side so it can be rate limited.
 */
export async function verifyMfaChallenge(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rl = await hitRateLimit(`mfa:${user.id}`, 5, 900);
  if (!rl.allowed) {
    const msg = rl.unavailable
      ? RATE_LIMIT_UNAVAILABLE_MSG
      : TOO_MANY_ATTEMPTS_MSG;
    redirect(`/auth/mfa?error=${encodeURIComponent(msg)}`);
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp.find((f) => f.status === "verified");
  if (!totp) redirect("/auth/mfa/enroll");

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: totp.id,
    code: (formData.get("code") as string) ?? "",
  });

  if (error) {
    redirect(`/auth/mfa?error=${encodeURIComponent("Invalid code.")}`);
  }

  redirect(safeNext(formData.get("next") as string));
}

/**
 * Verify the first code during enrollment, then mint single-use backup
 * codes. Returns the plaintext codes exactly once — only hashes persist.
 */
export async function verifyEnrollment(
  factorId: string,
  code: string
): Promise<{ error?: string; backupCodes?: string[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const rl = await hitRateLimit(`mfa-enroll:${user.id}`, 5, 900);
  if (!rl.allowed) {
    return {
      error: rl.unavailable
        ? RATE_LIMIT_UNAVAILABLE_MSG
        : TOO_MANY_ATTEMPTS_MSG,
    };
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });
  if (error) return { error: error.message };

  // Session is now aal2 — the insert/delete policies require it.
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode);

  await supabase.from("backup_codes").delete().eq("user_id", user.id);
  const { error: insertError } = await supabase
    .from("backup_codes")
    .insert(codes.map((c) => ({ code_hash: hashCode(c) })));

  if (insertError) {
    // Factor is verified either way; codes can be regenerated later.
    console.error("backup code insert failed:", insertError.message);
    return { backupCodes: [] };
  }

  return { backupCodes: codes };
}

/**
 * Redeem a backup code at aal1 (lost TOTP device). On success the TOTP
 * factor is deleted via the Admin API and the user re-enrolls.
 */
export async function recoverWithBackupCode(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rl = await hitRateLimit(`recovery:${user.id}`, 5, 3600);
  if (!rl.allowed) {
    const msg = rl.unavailable
      ? RATE_LIMIT_UNAVAILABLE_MSG
      : TOO_MANY_ATTEMPTS_MSG;
    redirect(`/auth/mfa/recovery?error=${encodeURIComponent(msg)}`);
  }

  const submittedHash = Buffer.from(
    hashCode((formData.get("code") as string) ?? ""),
    "hex"
  );

  const { data: rows } = await supabase
    .from("backup_codes")
    .select("id, code_hash")
    .is("used_at", null);

  const match = (rows ?? []).find((r) =>
    timingSafeEqual(Buffer.from(r.code_hash, "hex"), submittedHash)
  );

  if (!match) {
    redirect(
      `/auth/mfa/recovery?error=${encodeURIComponent(
        "That code is invalid or already used."
      )}`
    );
  }

  await supabase
    .from("backup_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", match.id);

  // Remove the lost factor so the proxy routes to fresh enrollment.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const admin = createAdminClient();
  for (const f of factors?.all ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id });
  }

  redirect("/auth/mfa/enroll");
}
