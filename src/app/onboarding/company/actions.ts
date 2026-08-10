"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/onboarding";
import { companyInfoSchema } from "@/lib/zod";
import {
  searchKvkCompanies,
  getKvkCompanyDetails,
  type KvkSearchResult,
  type KvkCompanyDetails,
} from "@/lib/kvk";

/**
 * Thin RPC wrappers so the client form (company-form.tsx) can call the KVK
 * API without KVK_API_KEY ever reaching the browser — src/lib/kvk.ts is
 * server-only, these "use server" exports are the only door into it.
 */
export async function searchKvk(query: string): Promise<KvkSearchResult[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return searchKvkCompanies(query);
}

export async function getKvkDetails(
  kvkNumber: string
): Promise<KvkCompanyDetails | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getKvkCompanyDetails(kvkNumber);
}

/** The organisation this user belongs to, if any (see src/lib/onboarding.ts). */
async function getOwnOrganisationId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.organisation_id ?? null;
}

export async function saveCompanyInfo(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Sequential lock, enforced server-side too — not just by hiding the link.
  const status = await getOnboardingStatus(supabase, user.id);
  if (!status.personalDone) redirect("/onboarding/personal");

  const parsed = companyInfoSchema.safeParse({
    companyCountry: (formData.get("companyCountry") as string) ?? "",
    kvkNumber: ((formData.get("kvkNumber") as string) ?? "").trim(),
    companyName: ((formData.get("companyName") as string) ?? "").trim(),
    companyStreet: ((formData.get("companyStreet") as string) ?? "").trim(),
    companyPostalCode: (
      (formData.get("companyPostalCode") as string) ?? ""
    ).trim(),
    companyCity: ((formData.get("companyCity") as string) ?? "").trim(),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(`/onboarding/company?error=${encodeURIComponent(message)}`);
  }

  const {
    companyCountry,
    kvkNumber,
    companyName,
    companyStreet,
    companyPostalCode,
    companyCity,
  } = parsed.data;

  const orgFields = {
    name: companyName,
    country: companyCountry,
    kvk_number: kvkNumber || null,
    street: companyStreet,
    postal_code: companyPostalCode,
    city: companyCity,
    company_completed_at: new Date().toISOString(),
  };

  const existingOrgId = await getOwnOrganisationId(supabase, user.id);

  if (existingOrgId) {
    // Revisiting/editing an org they already own — update in place.
    const { error } = await supabase
      .from("organisations")
      .update(orgFields)
      .eq("id", existingOrgId);
    if (error) {
      redirect(
        `/onboarding/company?error=${encodeURIComponent(error.message)}`
      );
    }
  } else {
    // First time through — create the org, then join it as owner.
    // The id is generated here (rather than left to the DB default +
    // read back via `.select()`) so we never need a SELECT against a row
    // the user isn't a member of yet — organisations_insert_any allows
    // the insert itself regardless, but there's no reason to rely on
    // RETURNING being exempt from the table's SELECT policy when we can
    // just... not need it.
    const organisationId = crypto.randomUUID();

    const { error: orgError } = await supabase
      .from("organisations")
      .insert({ id: organisationId, ...orgFields });
    if (orgError) {
      redirect(
        `/onboarding/company?error=${encodeURIComponent(orgError.message)}`
      );
    }

    const { error: memberError } = await supabase
      .from("organisation_members")
      .insert({ organisation_id: organisationId, user_id: user.id, role: "owner" });
    if (memberError) {
      redirect(
        `/onboarding/company?error=${encodeURIComponent(memberError.message)}`
      );
    }
  }

  redirect("/onboarding/adyen");
}
