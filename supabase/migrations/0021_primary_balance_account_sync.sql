-- ============================================================
-- 0021: Primary bank account sync + issued IBANs.
--
-- 1. Onboarding stores the org's first Adyen balance account on
--    organisations.adyen_balance_account_id (finish.ts), but the dashboard
--    reads public.balance_accounts (0020). 0020 only backfilled once, so
--    every org onboarded since had no accounts on the dashboard. A trigger
--    now adds the matching primary row whenever that column is set.
-- 2. Each balance account gets a bank account (an IBAN, Adyen "payment
--    instrument" of type bankAccount) once Adyen allows it — see
--    src/lib/adyen/bank-accounts.ts. Its id and IBAN are stored here.
-- 3. The primary account is called "Bank account" (was "Operating account").
--
-- Safe to re-run. Run in Supabase SQL Editor, or `supabase db push`.
-- ============================================================

alter table public.balance_accounts
  add column if not exists adyen_payment_instrument_id text unique,
  add column if not exists iban text,
  -- Set while an IBAN is being requested, so two webhooks arriving at
  -- once can't each issue one.
  add column if not exists bank_account_claimed_at timestamptz;

update public.balance_accounts set name = 'Bank account' where name = 'Operating account' and is_primary;

create or replace function private.sync_primary_balance_account()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.adyen_balance_account_id is not null then
    insert into public.balance_accounts (organisation_id, adyen_balance_account_id, name, currency, is_primary)
    values (new.id, new.adyen_balance_account_id, 'Bank account', 'EUR', true)
    on conflict (adyen_balance_account_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_primary_balance_account() from public;

drop trigger if exists organisations_sync_primary_balance_account on public.organisations;
create trigger organisations_sync_primary_balance_account
  after insert or update of adyen_balance_account_id on public.organisations
  for each row execute function private.sync_primary_balance_account();

-- Orgs onboarded between 0020 and now.
insert into public.balance_accounts (organisation_id, adyen_balance_account_id, name, currency, is_primary)
select id, adyen_balance_account_id, 'Bank account', 'EUR', true
from public.organisations
where adyen_balance_account_id is not null
on conflict (adyen_balance_account_id) do nothing;
