"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryOrganisationId } from "@/lib/organisation";

/**
 * Note: none of these actions filter by user_id — RLS does it.
 * The insert policy also enforces user_id = auth.uid(), and a DB default
 * fills it in, so the client can't spoof another user's id.
 */

/**
 * revalidatePath needs a concrete path — "/org/[orgId]/dashboard" isn't
 * one — so look up the org id the same way the bare /dashboard redirect
 * does, rather than threading it through every form as a hidden field.
 */
async function revalidateDashboard(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const orgId = await getPrimaryOrganisationId(supabase, user.id);
  if (orgId) revalidatePath(`/org/${orgId}/dashboard`);
}

export async function addTodo(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("todos").insert({ task: formData.get("task") as string });
  await revalidateDashboard(supabase);
}

export async function toggleTodo(formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("todos")
    .update({ is_complete: formData.get("done") === "true" })
    .eq("id", formData.get("id") as string);
  await revalidateDashboard(supabase);
}

export async function deleteTodo(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("todos").delete().eq("id", formData.get("id") as string);
  await revalidateDashboard(supabase);
}
