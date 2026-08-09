-- ============================================================
-- 0004: Swap "place of birth" for residential address on the personal
-- onboarding step, and store the Adyen legal entity id created from it.
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

-- ---------- Drop place-of-birth columns (migration 0003) ----------
alter table public.profiles
  drop column if exists birth_city,
  drop column if exists birth_postal_code,
  drop column if exists birth_country;

-- ---------- Add residential address + Adyen linkage ----------
alter table public.profiles
  add column residential_street      text,
  add column residential_city        text,
  add column residential_postal_code text,
  add column residential_country     text, -- ISO 3166-1 alpha-2
  -- Adyen's Individual.name needs firstName/lastName separately; profiles
  -- only had the concatenated full_name until now. Sourced from the same
  -- signup metadata full_name already comes from.
  add column first_name text,
  add column last_name  text,
  -- The `id` (e.g. "LE...") returned by POST /legalEntities once the
  -- personal step successfully creates the individual in Adyen. Null
  -- until that call succeeds — see src/lib/adyen.ts.
  add column adyen_legal_entity_id text;

-- Backfill first_name/last_name for rows created before this migration
-- (the trigger below only fires on new signups going forward).
update public.profiles p
set
  first_name = coalesce(p.first_name, u.raw_user_meta_data ->> 'first_name'),
  last_name  = coalesce(p.last_name, u.raw_user_meta_data ->> 'last_name')
from auth.users u
where u.id = p.id
  and (p.first_name is null or p.last_name is null);

-- Keep the signup trigger (migration 0001) in sync so new profiles rows
-- get first_name/last_name populated automatically, same as full_name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, first_name, last_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  return new;
end;
$$;
