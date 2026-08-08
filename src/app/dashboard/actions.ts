"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Note: none of these actions filter by user_id — RLS does it.
 * The insert policy also enforces user_id = auth.uid(), and a DB default
 * fills it in, so the client can't spoof another user's id.
 */

export async function addTodo(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("todos").insert({ task: formData.get("task") as string });
  revalidatePath("/dashboard");
}

export async function toggleTodo(formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("todos")
    .update({ is_complete: formData.get("done") === "true" })
    .eq("id", formData.get("id") as string);
  revalidatePath("/dashboard");
}

export async function deleteTodo(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("todos").delete().eq("id", formData.get("id") as string);
  revalidatePath("/dashboard");
}
