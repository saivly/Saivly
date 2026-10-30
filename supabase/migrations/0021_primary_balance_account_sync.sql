-- Onboarding stores the org's first Adyen balance account on
-- organisations.adyen_balance_account_id (finish.ts), but the dashboard
-- reads public.balance_accounts (0020). 0020 only backfilled once, so
-- every org onboarded since has no accounts on the dashboard.
--
-- This trigger adds the matching primary balance_accounts row whenever
-- that column is set. It runs as the table owner because RLS rightly
-- doesn't let users insert primary accounts themselves.

create or replace function private.sync_primary_balance_account()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.adyen_balance_account_id is not null then
    insert into public.balance_accounts (organisation_id, adyen_balance_account_id, name, currency, is_primary)
    values (new.id, new.adyen_balance_account_id, 'Operating account', 'EUR', true)
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
select id, adyen_balance_account_id, 'Operating account', 'EUR', true
from public.organisations
where adyen_balance_account_id is not null
on conflict (adyen_balance_account_id) do nothing;
