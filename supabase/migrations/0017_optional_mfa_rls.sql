-- ============================================================
-- 0017: Stop the DB's "require aal2" policies from locking out accounts
-- that were never going to reach real aal2 in the first place.
--
-- MFA is optional in this app (see the enforcement ladder in
-- src/lib/supabase/proxy.ts): an account with neither a verified TOTP
-- factor nor a passkey clears its second factor for the session via an
-- emailed 8-digit code instead, tracked by an app-level cookie — not the
-- JWT. Passkeys likewise never raise the real `aal` claim (same file's
-- module comment) — only a verified TOTP factor does.
--
-- Every "*_require_aal2" restrictive policy added since migration 0001
-- assumed every session eventually reaches real aal2. For any account
-- that hasn't enrolled an authenticator app — which is every brand-new
-- signup, since TOTP is opt-in and the security nudge can be skipped —
-- that assumption is false: aal1 is the ceiling they can ever reach, so
-- these policies silently zero out every query against profiles,
-- organisations, invoices, etc. That's what was surfacing as "Cannot
-- coerce the result to a single JSON object" on the onboarding
-- personal-info step (an update-then-.single() hitting 0 visible rows).
--
-- Fix, matching Supabase's own recommended pattern for this exact
-- situation ("Restrict access to authenticated users with MFA and to
-- users without MFA"): only require real aal2 for accounts that actually
-- have a verified TOTP factor to reach it with. Accounts with none just
-- need to be authenticated at all — same as before, the DB is simply no
-- longer stricter than the app for them; the proxy's own enforcement
-- (emailed code / passkey / security nudge) is still what gates their
-- session at the HTTP layer.
--
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

-- Not part of the "public" schema PostgREST exposes over the API — this
-- is a DB-internal helper for RLS policies only.
create schema if not exists private;

create or replace function private.has_verified_totp(user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from auth.mfa_factors
    where auth.mfa_factors.user_id = has_verified_totp.user_id
      and factor_type = 'totp'
      and status = 'verified'
  );
$$;

revoke all on function private.has_verified_totp(uuid) from public, anon, authenticated;
grant execute on function private.has_verified_totp(uuid) to authenticated;

-- ---------- PROFILES / TODOS (migration 0001) ----------
drop policy "profiles_require_aal2" on public.profiles;
create policy "profiles_require_aal2"
  on public.profiles as restrictive
  to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    or not private.has_verified_totp((select auth.uid()))
  );

drop policy "todos_require_aal2" on public.todos;
create policy "todos_require_aal2"
  on public.todos as restrictive
  to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    or not private.has_verified_totp((select auth.uid()))
  );

-- ---------- ORGANISATIONS (migration 0003) ----------
drop policy "organisations_require_aal2" on public.organisations;
create policy "organisations_require_aal2"
  on public.organisations as restrictive
  to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    or not private.has_verified_totp((select auth.uid()))
  );

drop policy "organisation_members_require_aal2" on public.organisation_members;
create policy "organisation_members_require_aal2"
  on public.organisation_members as restrictive
  to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    or not private.has_verified_totp((select auth.uid()))
  );

-- join_organisation() is SECURITY DEFINER (bypasses RLS entirely), so it
-- re-checks the AAL2 requirement by hand instead of relying on the
-- policies above — same relaxation applies there.
create or replace function public.join_organisation(target_org_id uuid, claimed_name text)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  actual_name text;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    return false;
  end if;

  if (select auth.jwt() ->> 'aal') is distinct from 'aal2'
     and private.has_verified_totp(uid) then
    return false; -- has TOTP enrolled but this session hasn't cleared it
  end if;

  select name into actual_name
  from public.organisations
  where id = target_org_id;

  if actual_name is null then
    return false; -- no such organisation
  end if;

  if lower(trim(actual_name)) is distinct from lower(trim(claimed_name)) then
    return false; -- wrong name for that id — treat the pair as the invite code
  end if;

  insert into public.organisation_members (organisation_id, user_id, role)
  values (target_org_id, uid, 'member')
  on conflict (organisation_id, user_id) do nothing;

  return true;
end;
$$;

-- ---------- ADYEN WEBHOOK EVENTS (migration 0015) ----------
drop policy "adyen_payment_webhook_events_require_aal2" on public.adyen_payment_webhook_events;
create policy "adyen_payment_webhook_events_require_aal2"
  on public.adyen_payment_webhook_events as restrictive
  to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    or not private.has_verified_totp((select auth.uid()))
  );

drop policy "adyen_configuration_webhook_events_require_aal2" on public.adyen_configuration_webhook_events;
create policy "adyen_configuration_webhook_events_require_aal2"
  on public.adyen_configuration_webhook_events as restrictive
  to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    or not private.has_verified_totp((select auth.uid()))
  );

drop policy "adyen_transfer_webhook_events_require_aal2" on public.adyen_transfer_webhook_events;
create policy "adyen_transfer_webhook_events_require_aal2"
  on public.adyen_transfer_webhook_events as restrictive
  to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    or not private.has_verified_totp((select auth.uid()))
  );

-- ---------- INVOICES (migration 0016) ----------
drop policy "invoices_require_aal2" on public.invoices;
create policy "invoices_require_aal2"
  on public.invoices as restrictive
  to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    or not private.has_verified_totp((select auth.uid()))
  );

drop policy "invoice_objects_require_aal2" on storage.objects;
create policy "invoice_objects_require_aal2"
  on storage.objects as restrictive
  to authenticated
  using (
    bucket_id != 'invoices'
    or (select auth.jwt() ->> 'aal') = 'aal2'
    or not private.has_verified_totp((select auth.uid()))
  );
