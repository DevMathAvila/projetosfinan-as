-- Renda extra pontual (ex.: entrou R$ 100 de uma venda). Vale so para o ciclo do cartao em que foi lancada,
-- igual aos gastos avulsos (expenses). Tabela nova: nao altera nenhuma tabela existente.
create table if not exists public.extra_incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  cycle_id uuid not null references public.billing_cycles(id) on delete cascade,
  value numeric(12,2) not null check (value > 0),
  description text,
  received_date date not null default current_date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists extra_incomes_household_cycle_idx on public.extra_incomes (household_id, cycle_id);

alter table public.extra_incomes enable row level security;

drop policy if exists "extra_incomes member all" on public.extra_incomes;
create policy "extra_incomes member all" on public.extra_incomes
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
