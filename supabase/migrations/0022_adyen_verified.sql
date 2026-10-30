-- ============================================================
-- 0022: Adyen verification gate.
--
-- After the subscription step, users wait on /verifying until Adyen
-- reports every requested capability on the org's account holder as
-- valid. organisations.adyen_verified_at is set at that moment and never
-- cleared — once an org has been through it, the waiting screen never
-- comes back, even if a capability later turns invalid.
-- See src/lib/adyen/verification.ts.
--
-- Safe to re-run. Run in Supabase SQL Editor, or `supabase db push`.
-- ============================================================

alter table public.organisations
  add column if not exists adyen_verified_at timestamptz;

-- Members can update their organisation (RLS), so without this a user
-- could set adyen_verified_at themselves and skip the wait. Only the
-- server (service role) may change it.
create or replace function private.protect_adyen_verified_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.adyen_verified_at is distinct from old.adyen_verified_at
     and coalesce(auth.role(), '') <> 'service_role' then
    new.adyen_verified_at := old.adyen_verified_at;
  end if;
  return new;
end;
$$;

drop trigger if exists organisations_protect_adyen_verified_at on public.organisations;
create trigger organisations_protect_adyen_verified_at
  before update on public.organisations
  for each row execute function private.protect_adyen_verified_at();
