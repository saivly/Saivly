"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { personalInfoSchema } from "@/lib/zod";
import { createAdyenIndividual } from "@/lib/adyen/legalEntity";
import { lookupDutchAddress, type DutchAddress } from "@/lib/pdok";

/**
 * Thin RPC wrapper so the client form (personal-form.tsx) can call PDOK
 * from the browser without exposing the fetch directly — mirrors the KVK
 * wrappers in ../company/actions.ts. PDOK itself needs no API key, this
 * just keeps the lookup gated behind an authenticated session like the
 * rest of onboarding.
 */
export async function lookupResidentialAddress(
  postcode: string,
  houseNumber: string
): Promise<DutchAddress | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return lookupDutchAddress(postcode, houseNumber);
}

export async function savePersonalInfo(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = personalInfoSchema.safeParse({
    dateOfBirth: (formData.get("dateOfBirth") as string) ?? "",
    phoneNumber: ((formData.get("phoneNumber") as string) ?? "").trim(),
    residentialStreet: ((formData.get("residentialStreet") as string) ?? "").trim(),
    residentialCity: ((formData.get("residentialCity") as string) ?? "").trim(),
    residentialProvince: (
      (formData.get("residentialProvince") as string) ?? ""
    ).trim(),
    residentialPostalCode: (
      (formData.get("residentialPostalCode") as string) ?? ""
    ).trim(),
    residentialCountry: (formData.get("residentialCountry") as string) ?? "",
    nationality: (formData.get("nationality") as string) ?? "",
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(`/onboarding/personal?error=${encodeURIComponent(message)}`);
  }

  const {
    dateOfBirth,
    phoneNumber,
    residentialStreet,
    residentialCity,
    residentialProvince,
    residentialPostalCode,
    residentialCountry,
    nationality,
  } = parsed.data;

  // The row always exists already — created by the signup trigger
  // (migration 0001) — so this is a plain update, not an upsert.
  //
  // personal_completed_at is deliberately NOT set here: it's only stamped
  // once Adyen legal-entity registration below is confirmed, so that
  // getOnboardingStatus() (src/lib/onboarding.ts) never lets someone into
  // the company step without an adyen_legal_entity_id. Everything else is
  // saved unconditionally so a failed/retried attempt doesn't lose input.
  const { data: profile, error } = await supabase
    .from("profiles")
    .update({
      date_of_birth: dateOfBirth,
      phone_number: phoneNumber,
      residential_street: residentialStreet,
      residential_city: residentialCity,
      residential_province: residentialProvince || null,
      residential_postal_code: residentialPostalCode,
      residential_country: residentialCountry,
      nationality,
    })
    .eq("id", user.id)
    .select("first_name, last_name, adyen_legal_entity_id")
    .single();

  if (error) {
    redirect(
      `/onboarding/personal?error=${encodeURIComponent(error.message)}`
    );
  }

  // Register with Adyen once, not on every re-edit of this step — creating
  // a legal entity mints a new id each time, and updating an existing one
  // is a separate PATCH /legalEntities/{id} call this doesn't attempt.
  let legalEntityId = profile.adyen_legal_entity_id;

  if (!legalEntityId) {
    const firstName = profile.first_name ?? user.user_metadata?.first_name;
    const lastName = profile.last_name ?? user.user_metadata?.last_name;

    legalEntityId =
      firstName && lastName && user.email
        ? await createAdyenIndividual({
            firstName,
            lastName,
            email: user.email,
            phoneNumber,
            dateOfBirth,
            residentialAddress: {
              street: residentialStreet,
              city: residentialCity,
              postalCode: residentialPostalCode,
              country: residentialCountry,
              stateOrProvince: residentialProvince || undefined,
            },
          })
        : null;

    // Required, not best-effort: getOnboardingStatus() won't consider this
    // step done without adyen_legal_entity_id, so don't let the user past
    // it either. createAdyenIndividual already logs the underlying reason
    // (e.g. ADYEN_LEGALENTITY_API_KEY missing/invalid — see src/lib/adyen.ts).
    if (!legalEntityId) {
      redirect(
        `/onboarding/personal?error=${encodeURIComponent(
          "We couldn't complete identity verification with our payment provider. Your details were saved — please try again, or contact support if this keeps happening."
        )}`
      );
    }

    await supabase
      .from("profiles")
      .update({ adyen_legal_entity_id: legalEntityId })
      .eq("id", user.id);
  }

  await supabase
    .from("profiles")
    .update({ personal_completed_at: new Date().toISOString() })
    .eq("id", user.id);

  redirect("/onboarding/company");
}
