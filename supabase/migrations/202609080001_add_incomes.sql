-- Renda mensal do household (o "quanto entra") para calcular sobra e quanto da pra gastar.
create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  value numeric(12,2) not null check (value >= 0),
  income_type text not null default 'fixed' check (income_type in ('fixed', 'variable')),
  active boolean not null default true,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists incomes_household_idx on public.incomes (household_id);

alter table public.incomes enable row level security;

drop policy if exists "incomes member all" on public.incomes;
create policy "incomes member all" on public.incomes
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
