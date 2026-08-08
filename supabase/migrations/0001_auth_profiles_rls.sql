-- ============================================================
-- 0001: Profiles + Todos with Row Level Security
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

-- ---------- PROFILES ----------
-- One row per auth user, auto-created by trigger on signup.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Read: users can read only their own profile.
-- (Change `to authenticated using (true)` if profiles should be public.)
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- Update: users can update only their own profile.
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No insert/delete policies: rows are created by the trigger below
-- (security definer bypasses RLS) and deleted via auth.users cascade.

-- Auto-create a profile when a user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at fresh.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- TODOS (example of full CRUD under RLS) ----------
create table public.todos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task        text not null check (char_length(task) between 1 and 500),
  is_complete boolean not null default false,
  created_at  timestamptz not null default now()
);

create index todos_user_id_idx on public.todos (user_id);

alter table public.todos enable row level security;

create policy "todos_select_own"
  on public.todos for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "todos_insert_own"
  on public.todos for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "todos_update_own"
  on public.todos for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "todos_delete_own"
  on public.todos for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================
-- RLS notes
-- - `(select auth.uid())` (vs bare auth.uid()) lets Postgres cache the
--   result per statement — a meaningful perf win on large scans.
-- - `to authenticated` skips policy evaluation entirely for anon requests.
-- - The service_role key BYPASSES RLS. Keep it server-side only.
-- - Every new table you create is exposed via the API: enabling RLS on
--   every public table is not optional.
-- ============================================================

-- ---------- AAL2 ENFORCEMENT AT THE DATABASE LAYER ----------
-- The proxy already forces TOTP, but the database shouldn't trust the
-- app layer. These RESTRICTIVE policies AND with the owner policies
-- above: even a valid aal1 session gets zero rows.
-- (Restrictive = must pass IN ADDITION to at least one permissive policy.)

create policy "profiles_require_aal2"
  on public.profiles as restrictive
  to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');

create policy "todos_require_aal2"
  on public.todos as restrictive
  to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');
