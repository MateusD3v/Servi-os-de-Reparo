create table if not exists public.finance_app_state (
  profile text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.finance_app_state enable row level security;

drop policy if exists "service_role_manage_finance_app_state" on public.finance_app_state;

create policy "service_role_manage_finance_app_state"
on public.finance_app_state
as permissive
for all
to service_role
using (true)
with check (true);
