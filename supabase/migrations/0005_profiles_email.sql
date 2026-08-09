-- ============================================================
-- 0005: Mirror the user's email onto profiles.
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

alter table public.profiles add column email text;

-- Backfill existing rows from auth.users before enforcing not null.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is null;

alter table public.profiles alter column email set not null;

-- email is system-managed, not user-editable — mirrored from auth.users
-- by the triggers below, same spirit as full_name/first_name/last_name
-- at signup. There's deliberately no "Update" path for it in
-- database.types.ts; the only way it changes is through Supabase's own
-- email-change flow on auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, first_name, last_name, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email
  );
  return new;
end;
$$;

-- Keep profiles.email in sync if the user ever changes their login email
-- (there's no "change email" UI in the app yet, but Supabase's own
-- updateUser({ email }) flow hits auth.users directly, bypassing any
-- app-level write path).
create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();
