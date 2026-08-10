-- ============================================================
-- 0008: join_organisation() — lets an authenticated user join an
-- existing organisation by supplying its id + exact name together,
-- used by the "join an existing organisation" fork on
-- /onboarding/organisation (see src/app/onboarding/organisation/join).
--
-- The (id, name) pair is the invite code: an org's owner shares both
-- with a teammate out of band (the id is shown to owners on the company
-- onboarding step). SECURITY DEFINER because a non-member can't SELECT
-- organisations (organisations_select_member) to check the name before
-- becoming a member — this function only ever returns true/false, never
-- exposing anything else about the row, and always joins as 'member'
-- (never 'owner', unlike organisation_members' own insert default).
--
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

create or replace function public.join_organisation(target_org_id uuid, claimed_name text)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  actual_name text;
  uid uuid := (select auth.uid());
begin
  -- SECURITY DEFINER bypasses RLS entirely, so the AAL2 requirement the
  -- table's own restrictive policies would otherwise enforce is
  -- re-checked here by hand.
  if uid is null or (select auth.jwt() ->> 'aal') is distinct from 'aal2' then
    return false;
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

revoke all on function public.join_organisation(uuid, text) from public;
grant execute on function public.join_organisation(uuid, text) to authenticated;
