-- ============================================================
-- 0020: Data model behind the org dashboard (Overview, Accounts,
-- Payments & payouts, Reports, Settings).
--
--   organisations   + default_currency, ip_allowlist_enabled,
--                     large_payment_alerts_enabled (Settings page).
--   balance_accounts  one row per Adyen balance account an org owns.
--                     Backfilled from organisations.adyen_balance_account_id
--                     (the one created during onboarding). Balances are
--                     NOT stored — they're read live from Adyen.
--   transfers       a projection of Adyen transfer webhooks
--                     (adyen_transfer_webhook_events): one row per Adyen
--                     transfer, kept at its latest state. Incoming
--                     payments, payouts and the Overview stats all read
--                     from here. Written only by the service role.
--   reports         report jobs from the Reports page. Files live in
--                     the private "reports" storage bucket.
--   api_keys        hashed API keys (the plaintext is shown once, never
--                     stored).
--
-- Every new table follows the same RLS shape as the rest of the app:
-- members of the organisation can read, plus the restrictive "aal2 when
-- the user has TOTP" policy from migration 0017.
--
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

-- ---------- ORGANISATIONS: settings ----------
alter table public.organisations
  add column if not exists default_currency text not null default 'EUR'
    check (default_currency ~ '^[A-Z]{3}$'),
  add column if not exists ip_allowlist_enabled boolean not null default false,
  add column if not exists large_payment_alerts_enabled boolean not null default true;

-- Owner check for settings-type writes (API keys, opening accounts).
-- SECURITY DEFINER for the same recursion reason as is_org_member.
create or replace function public.is_org_owner(org_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organisation_members m
    where m.organisation_id = org_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

-- ---------- BALANCE ACCOUNTS ----------
create table public.balance_accounts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  adyen_balance_account_id text not null unique,
  name       text not null,
  currency   text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index balance_accounts_organisation_idx on public.balance_accounts (organisation_id);

insert into public.balance_accounts (organisation_id, adyen_balance_account_id, name, currency, is_primary)
select id, adyen_balance_account_id, 'Operating account', 'EUR', true
from public.organisations
where adyen_balance_account_id is not null
on conflict (adyen_balance_account_id) do nothing;

alter table public.balance_accounts enable row level security;

create policy "balance_accounts_select_member"
  on public.balance_accounts for select
  to authenticated
  using (public.is_org_member(organisation_id));

create policy "balance_accounts_insert_owner"
  on public.balance_accounts for insert
  to authenticated
  with check (public.is_org_owner(organisation_id) and is_primary = false);

create policy "balance_accounts_require_aal2"
  on public.balance_accounts as restrictive
  to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    or not private.has_verified_totp((select auth.uid()))
  );

-- ---------- TRANSFERS ----------
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,

  adyen_transfer_id  text not null unique,
  balance_account_id text,            -- Adyen balance account id (not balance_accounts.id)
  category   text,                    -- Adyen: bank / platformPayment / internal / ...
  type       text,                    -- Adyen: bankTransfer / capture / chargeback / ...
  direction  text not null check (direction in ('incoming', 'outgoing')),
  status     text not null,           -- Adyen's raw status, kept for reports/debugging

  -- What the dashboard shows. Derived from the fields above in
  -- src/lib/adyen/transfer-state.ts — keep the two in sync.
  kind  text not null check (kind in ('payment', 'payout', 'other')),
  state text not null check (state in ('pending', 'in_transit', 'succeeded', 'failed')),

  amount_value bigint not null check (amount_value >= 0), -- minor units
  currency     text not null,
  reference    text,
  description  text,
  counterparty_name    text,
  counterparty_account text,          -- already masked for display, e.g. "NL91 ABNA ···· 4300"

  sequence_number      integer not null default 0, -- Adyen's; stale webhooks never overwrite newer ones
  estimated_arrival_at timestamptz,
  adyen_created_at     timestamptz not null,
  updated_at           timestamptz not null default now()
);

create index transfers_org_kind_created_idx on public.transfers (organisation_id, kind, adyen_created_at desc);
create index transfers_org_created_idx on public.transfers (organisation_id, adyen_created_at desc);

alter table public.transfers enable row level security;

create policy "transfers_select_member"
  on public.transfers for select
  to authenticated
  using (public.is_org_member(organisation_id));

create policy "transfers_require_aal2"
  on public.transfers as restrictive
  to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    or not private.has_verified_totp((select auth.uid()))
  );

-- Overview: monthly incoming/outgoing volume, last 12 months including
-- this one, zero-filled. SECURITY INVOKER so the RLS above still applies.
create or replace function public.transfer_monthly_volume(org_id uuid, p_currency text)
returns table (month date, incoming bigint, outgoing bigint)
language sql
stable
security invoker set search_path = ''
as $$
  with months as (
    select generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    )::date as month
  )
  select
    m.month,
    coalesce(sum(t.amount_value) filter (where t.direction = 'incoming'), 0)::bigint,
    coalesce(sum(t.amount_value) filter (where t.direction = 'outgoing'), 0)::bigint
  from months m
  left join public.transfers t
    on t.organisation_id = org_id
   and t.currency = p_currency
   and t.state in ('succeeded', 'in_transit')
   and date_trunc('month', t.adyen_created_at)::date = m.month
  group by m.month
  order by m.month;
$$;

-- Overview: 30-day totals vs the 30 days before, for the stat cards.
create or replace function public.transfer_stats(org_id uuid, p_currency text)
returns table (
  incoming_30d bigint, incoming_prev bigint,
  outgoing_30d bigint, outgoing_prev bigint,
  succeeded_30d bigint, failed_30d bigint,
  succeeded_prev bigint, failed_prev bigint
)
language sql
stable
security invoker set search_path = ''
as $$
  select
    coalesce(sum(amount_value) filter (where direction = 'incoming' and state = 'succeeded' and adyen_created_at >= now() - interval '30 days'), 0)::bigint,
    coalesce(sum(amount_value) filter (where direction = 'incoming' and state = 'succeeded' and adyen_created_at <  now() - interval '30 days'), 0)::bigint,
    coalesce(sum(amount_value) filter (where direction = 'outgoing' and state in ('succeeded', 'in_transit') and adyen_created_at >= now() - interval '30 days'), 0)::bigint,
    coalesce(sum(amount_value) filter (where direction = 'outgoing' and state in ('succeeded', 'in_transit') and adyen_created_at <  now() - interval '30 days'), 0)::bigint,
    count(*) filter (where kind = 'payment' and state = 'succeeded' and adyen_created_at >= now() - interval '30 days'),
    count(*) filter (where kind = 'payment' and state = 'failed'    and adyen_created_at >= now() - interval '30 days'),
    count(*) filter (where kind = 'payment' and state = 'succeeded' and adyen_created_at <  now() - interval '30 days'),
    count(*) filter (where kind = 'payment' and state = 'failed'    and adyen_created_at <  now() - interval '30 days')
  from public.transfers
  where organisation_id = org_id
    and currency = p_currency
    and adyen_created_at >= now() - interval '60 days';
$$;

-- ---------- REPORTS ----------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,

  report_type text not null check (report_type in ('transactions', 'settlements', 'balances', 'disputes')),
  period      text not null check (period in ('this_month', 'last_month', 'this_quarter', 'last_quarter', 'year_to_date')),
  period_start timestamptz not null,
  period_end   timestamptz not null,   -- exclusive
  period_label text not null,          -- "October 2026", "Q3 2026", ...
  balance_account_id uuid references public.balance_accounts (id) on delete set null, -- null = all accounts
  format text not null check (format in ('csv', 'xlsx', 'pdf')),

  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  file_path  text,
  size_bytes bigint,
  row_count  integer,
  error      text,

  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index reports_organisation_idx on public.reports (organisation_id, created_at desc);

alter table public.reports enable row level security;

create policy "reports_select_member"
  on public.reports for select
  to authenticated
  using (public.is_org_member(organisation_id));

-- Members create jobs; only the service role (the generator) moves
-- them to ready/failed.
create policy "reports_insert_member"
  on public.reports for insert
  to authenticated
  with check (
    public.is_org_member(organisation_id)
    and created_by = (select auth.uid())
    and status = 'pending'
    and file_path is null
  );

create policy "reports_require_aal2"
  on public.reports as restrictive
  to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    or not private.has_verified_totp((select auth.uid()))
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reports',
  'reports',
  false,
  52428800, -- 50 MB
  array[
    'text/csv',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

-- Objects are "<organisation_id>/<report_id>.<ext>". Members can read
-- (via signed URLs); only the service role writes.
create policy "report_objects_select_member"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'reports'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "report_objects_require_aal2"
  on storage.objects as restrictive
  to authenticated
  using (
    bucket_id != 'reports'
    or (select auth.jwt() ->> 'aal') = 'aal2'
    or not private.has_verified_totp((select auth.uid()))
  );

-- ---------- API KEYS ----------
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,

  name        text not null check (char_length(name) between 1 and 60),
  environment text not null check (environment in ('live', 'test')),
  key_prefix  text not null,          -- "sv_live_" / "sv_test_"
  last_four   text not null,
  key_hash    text not null unique,   -- sha256 hex of the full key

  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index api_keys_organisation_idx on public.api_keys (organisation_id, created_at desc);

alter table public.api_keys enable row level security;

create policy "api_keys_select_member"
  on public.api_keys for select
  to authenticated
  using (public.is_org_member(organisation_id));

create policy "api_keys_insert_owner"
  on public.api_keys for insert
  to authenticated
  with check (
    public.is_org_owner(organisation_id)
    and created_by = (select auth.uid())
    and revoked_at is null
  );

-- Only used to revoke (set revoked_at).
create policy "api_keys_update_owner"
  on public.api_keys for update
  to authenticated
  using (public.is_org_owner(organisation_id))
  with check (public.is_org_owner(organisation_id));

create policy "api_keys_require_aal2"
  on public.api_keys as restrictive
  to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    or not private.has_verified_totp((select auth.uid()))
  );
