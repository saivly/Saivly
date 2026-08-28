-- ============================================================
-- 0016: Invoices — org members upload an invoice (file picker or phone
-- camera) from the new /org/[orgId]/invoices page; this table is the
-- index over the actual files, which live in the private "invoices"
-- storage bucket created below.
--
-- One row per uploaded file. No processing/OCR yet — this is just
-- storage + a list, so there's deliberately no status/amount/vendor
-- columns until something actually reads those fields.
--
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  uploaded_by     uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- Path inside the "invoices" storage bucket, always "<organisation_id>/…"
  -- — the storage policies below parse that prefix to authorize access,
  -- so this must stay in sync with however the upload action names objects.
  file_path  text not null unique,
  file_name  text not null, -- original filename, for display (file_path is a generated uuid, not human-readable)
  mime_type  text not null,
  size_bytes bigint not null check (size_bytes > 0),

  created_at timestamptz not null default now()
);

create index invoices_organisation_id_idx on public.invoices (organisation_id, created_at desc);

alter table public.invoices enable row level security;

create policy "invoices_select_member"
  on public.invoices for select
  to authenticated
  using (public.is_org_member(organisation_id));

create policy "invoices_insert_member"
  on public.invoices for insert
  to authenticated
  with check (
    public.is_org_member(organisation_id)
    and uploaded_by = (select auth.uid())
  );

-- Any member can remove an invoice, not just whoever uploaded it — same as
-- a shared drive folder. Revisit if invoices ever need an owner-only lock.
create policy "invoices_delete_member"
  on public.invoices for delete
  to authenticated
  using (public.is_org_member(organisation_id));

-- Same AAL2 requirement as every other table (see migration 0001's notes).
create policy "invoices_require_aal2"
  on public.invoices as restrictive
  to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');

-- ---------- STORAGE: private "invoices" bucket ----------
-- Not publicly readable — pages fetch files via short-lived signed URLs
-- (createSignedUrl), never the public URL helper.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoices',
  'invoices',
  false,
  15728640, -- 15 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
);

-- Objects are stored as "<organisation_id>/<uuid>-<filename>" — the first
-- path segment is the org id, so membership can be checked without a join
-- back to the invoices table (handy since a delete removes the storage
-- object and its invoices row in separate calls, not atomically).
create policy "invoice_objects_select_member"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'invoices'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "invoice_objects_insert_member"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'invoices'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "invoice_objects_delete_member"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'invoices'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "invoice_objects_require_aal2"
  on storage.objects as restrictive
  to authenticated
  using (
    bucket_id != 'invoices'
    or (select auth.jwt() ->> 'aal') = 'aal2'
  );
