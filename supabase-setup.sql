-- Bankboken: kör hela den här filen en gång i Supabase (SQL Editor → New query → klistra in → Run).

-- 1. Tabeller. Varje rad tillhör en inloggad person (user_id).
create table if not exists public.budget_months (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month      text not null,                 -- t.ex. 2026-10
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, month)
);

create table if not exists public.budget_settings (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  start_day  integer not null default 1 check (start_day in (1, 25)),
  updated_at timestamptz default now()
);

-- 2. Säkerhet: var och en ser och ändrar bara sin egen budget.
alter table public.budget_months   enable row level security;
alter table public.budget_settings enable row level security;

drop policy if exists "Egen budget" on public.budget_months;
create policy "Egen budget" on public.budget_months
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Egna inställningar" on public.budget_settings;
create policy "Egna inställningar" on public.budget_settings
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. Live-uppdatering mellan dina enheter (telefon och dator).
do $$ begin
  alter publication supabase_realtime add table public.budget_months;
exception when duplicate_object then null; end $$;
