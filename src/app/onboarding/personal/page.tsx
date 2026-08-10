import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PersonalForm from "./personal-form";

export default async function PersonalInfoStep({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Prefill from a previous partial save (e.g. they came back to edit).
  const { data: existing } = await supabase
    .from("profiles")
    .select(
      "date_of_birth, phone_number, residential_street, residential_city, residential_province, residential_postal_code, residential_country, nationality"
    )
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Personal information
        </h1>
        <p className="mt-2 text-sm text-muted">
          Step 1 of 4 — a few details we&apos;re required to collect about
          you.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <PersonalForm
        existing={{
          dateOfBirth: existing?.date_of_birth ?? "",
          phoneNumber: existing?.phone_number ?? "",
          residentialStreet: existing?.residential_street ?? "",
          residentialCity: existing?.residential_city ?? "",
          residentialProvince: existing?.residential_province ?? "",
          residentialPostalCode: existing?.residential_postal_code ?? "",
          residentialCountry: existing?.residential_country ?? "NL",
          nationality: existing?.nationality ?? "",
        }}
      />
    </div>
  );
}
