"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Keep in sync with the "invoices" bucket's file_size_limit /
// allowed_mime_types in supabase/migrations/0016_invoices.sql — checked
// here too so a rejected upload gets a clear message instead of a raw
// storage error, and so nothing is written to the invoices table for a
// file the bucket would refuse anyway.
const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

export type UploadInvoiceState = { error: string | null };

/**
 * None of this filters by organisation membership by hand — RLS does it
 * (see invoices_insert_member / invoice_objects_insert_member): a spoofed
 * orgId in the hidden field just makes both the storage upload and the
 * table insert fail closed.
 */
export async function uploadInvoice(
  _prevState: UploadInvoiceState,
  formData: FormData
): Promise<UploadInvoiceState> {
  const orgId = formData.get("orgId") as string | null;
  const file = formData.get("file") as File | null;

  if (!orgId) return { error: "Missing organisation." };
  if (!file || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_SIZE_BYTES) {
    return { error: "That file is too large — max 15 MB." };
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { error: "Unsupported file type — upload a photo or a PDF." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  // Object lives at "<orgId>/<uuid>.<ext>" — the storage policies parse
  // that first path segment as the organisation id (see migration 0016).
  const ext = file.name.includes(".") ? file.name.split(".").pop() : undefined;
  const objectPath = `${orgId}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(objectPath, file, { contentType: file.type });
  if (uploadError) {
    console.error("[invoices] storage upload failed:", uploadError);
    return { error: "Upload failed — try again." };
  }

  const { error: insertError } = await supabase.from("invoices").insert({
    organisation_id: orgId,
    file_path: objectPath,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  });
  if (insertError) {
    // Don't leave an orphaned object behind if the row failed.
    await supabase.storage.from("invoices").remove([objectPath]);
    console.error("[invoices] row insert failed:", insertError);
    return { error: "Upload failed — try again." };
  }

  revalidatePath(`/org/${orgId}/invoices`);
  return { error: null };
}

export async function deleteInvoice(formData: FormData) {
  const orgId = formData.get("orgId") as string;
  const id = formData.get("id") as string;
  const filePath = formData.get("filePath") as string;

  const supabase = await createClient();
  // Row first, then the object — an orphaned storage object is harmless,
  // an invoices row pointing at a missing file is a broken link on the page.
  await supabase.from("invoices").delete().eq("id", id);
  await supabase.storage.from("invoices").remove([filePath]);

  revalidatePath(`/org/${orgId}/invoices`);
}
