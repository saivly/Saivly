-- ============================================================
-- 0002: App-level rate limiting + MFA backup codes
-- ============================================================

-- ---------- RATE LIMITS ----------
-- Fixed-window counter, keyed by caller-defined strings like
-- "login:<ip>:<email>" or "mfa:<user_id>". Postgres-backed, so it
-- works on serverless/edge deploys with no extra infrastructure.

create table public.rate_limits (
  key          text primary key,
  count        int not null default 1,
  window_start timestamptz not null default now()
);

-- RLS on, zero policies: nothing can touch this table through the API.
-- Only the security definer function below reads/writes it.
alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated;

-- Returns true if the call is allowed, false if the limit is exceeded.
create function public.hit_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_allowed boolean;
begin
  insert into public.rate_limits as rl (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    count = case
      when rl.window_start < now() - make_interval(secs => p_window_seconds)
      then 1 else rl.count + 1 end,
    window_start = case
      when rl.window_start < now() - make_interval(secs => p_window_seconds)
      then now() else rl.window_start end
  returning count <= p_max into v_allowed;
  return v_allowed;
end;
$$;

grant execute on function public.hit_rate_limit to anon, authenticated;

-- Housekeeping: schedule with pg_cron (Dashboard -> Integrations), e.g. daily:
--   select cron.schedule('purge-rate-limits', '0 4 * * *',
--     $$delete from public.rate_limits where window_start < now() - interval '1 day'$$);

-- ---------- MFA BACKUP CODES ----------
-- Single-use recovery codes, stored as SHA-256 hashes only.
-- Generated server-side right after TOTP enrollment (requires aal2),
-- redeemable at aal1 (that's the whole point: the TOTP device is gone).

create table public.backup_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code_hash  text not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index backup_codes_user_id_idx on public.backup_codes (user_id);

alter table public.backup_codes enable row level security;

-- Read own hashes (needed at aal1 during recovery; hashes of high-entropy
-- codes leak nothing useful even to a hijacked aal1 session).
create policy "backup_codes_select_own"
  on public.backup_codes for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Create/replace codes only at aal2 (i.e. right after proving the factor).
create policy "backup_codes_insert_own_aal2"
  on public.backup_codes for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy "backup_codes_delete_own_aal2"
  on public.backup_codes for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

-- Marking a code used must work at aal1 (recovery scenario).
create policy "backup_codes_update_own"
  on public.backup_codes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
