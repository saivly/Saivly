-- ============================================================
-- 0003: Team onboarding data model — personal info on profiles,
-- company + subscription on organisations (many-to-many with users).
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

-- ---------- PROFILES: add onboarding's "personal" step ----------
-- profiles is already the app's public.users-equivalent (1 row per
-- auth.users, RLS'd owner-only + aal2, auto-created by the signup
-- trigger in migration 0001) — no need for a separate users table.
alter table public.profiles
  add column date_of_birth      date,
  add column phone_number       text,
  add column birth_city         text,
  add column birth_postal_code  text,
  add column birth_country      text, -- ISO 3166-1 alpha-2, see src/lib/countries.ts
  add column nationality        text, -- ISO 3166-1 alpha-2
  add column personal_completed_at timestamptz;

-- ---------- ORGANISATIONS ----------
-- Company + subscription data lives here, not on profiles — it's a fact
-- about the organisation, not about any one member. A teammate who joins
-- an already-set-up org later shouldn't have to redo these steps.
create table public.organisations (
  id uuid primary key default gen_random_uuid(),

  name          text not null,
  country       text not null, -- ISO 3166-1 alpha-2
  kvk_number    text,           -- only set when country = 'NL'
  street        text,
  postal_code   text,
  city          text,
  company_completed_at timestamptz,

  plan text check (plan in ('free', 'pro', 'enterprise')),
  subscription_completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- ORGANISATION_MEMBERS ----------
-- Many-to-many: one user can belong to several organisations, one
-- organisation can have several users. Whoever completes the company
-- step during onboarding becomes 'owner' of the organisation they create.
create table public.organisation_members (
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null default 'owner' check (role in ('owner', 'member')),
  created_at      timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

create index organisation_members_user_id_idx on public.organisation_members (user_id);

alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;

-- Membership check used by both tables' policies below. SECURITY DEFINER
-- + wrapped in a function (rather than an inline EXISTS on
-- organisation_members inside organisation_members' own policy) sidesteps
-- RLS-policy-references-its-own-table recursion.
create function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organisation_members m
    where m.organisation_id = org_id and m.user_id = (select auth.uid())
  );
$$;

create policy "organisations_select_member"
  on public.organisations for select
  to authenticated
  using (public.is_org_member(id));

-- Anyone can create an organisation (the company onboarding step does this
-- for a brand-new org); membership is what actually grants access to it
-- afterward, via organisation_members_insert_self below.
create policy "organisations_insert_any"
  on public.organisations for insert
  to authenticated
  with check (true);

create policy "organisations_update_member"
  on public.organisations for update
  to authenticated
  using (public.is_org_member(id))
  with check (public.is_org_member(id));

create policy "organisation_members_select_same_org"
  on public.organisation_members for select
  to authenticated
  using (public.is_org_member(organisation_id));

-- A user can only ever add THEMSELVES as a member — there's no invite
-- flow yet, so nothing needs to add other users' membership rows.
create policy "organisation_members_insert_self"
  on public.organisation_members for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Same AAL2 requirement as every other table (see migration 0001's notes).
create policy "organisations_require_aal2"
  on public.organisations as restrictive
  to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');

create policy "organisation_members_require_aal2"
  on public.organisation_members as restrictive
  to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');

create trigger organisations_set_updated_at
  before update on public.organisations
  for each row execute function public.set_updated_at();
