create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'household_role') then
    create type public.household_role as enum ('owner', 'member');
  end if;
end
$$;

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.household_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.access_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null,
  invited_by uuid not null references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, email)
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade unique,
  payment_day integer not null check (payment_day between 1 and 31),
  monthly_limit numeric(12,2) not null check (monthly_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (household_id, name)
);

create table if not exists public.billing_cycles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  start_date date not null,
  end_date date,
  closed boolean not null default false,
  monthly_limit numeric(12,2) not null check (monthly_limit > 0),
  total_spent numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists one_open_cycle_per_household
on public.billing_cycles (household_id)
where closed = false;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  cycle_id uuid not null references public.billing_cycles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  value numeric(12,2) not null check (value > 0),
  description text,
  expense_date timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  total_value numeric(12,2) not null check (total_value > 0),
  installment_value numeric(12,2) not null check (installment_value > 0),
  current_installment integer not null default 1,
  total_installments integer not null check (total_installments > 1),
  start_date date not null,
  active boolean not null default true,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  value numeric(12,2) not null check (value > 0),
  due_date date not null,
  due_day integer not null default 1 check (due_day between 1 and 31),
  paid boolean not null default false,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  bill_id uuid not null references public.bills(id) on delete cascade,
  payment_date date not null default current_date,
  value numeric(12,2) not null check (value > 0),
  created_at timestamptz not null default now()
);

create index if not exists expenses_household_expense_date_idx
on public.expenses (household_id, expense_date);

create index if not exists bills_household_due_date_idx
on public.bills (household_id, due_date);

create index if not exists installments_household_active_start_date_idx
on public.installments (household_id, active, start_date);

create index if not exists access_invites_household_created_at_idx
on public.access_invites (household_id, created_at desc);

create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household uuid;
  invited_household uuid;
begin
  select household_id into invited_household
  from public.access_invites
  where lower(email) = lower(new.email)
    and accepted_at is null
  order by created_at desc
  limit 1;

  if invited_household is null and exists (select 1 from public.profiles) then
    raise exception 'Cadastro fechado. Peca convite ao dono da familia.';
  end if;

  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));

  if invited_household is not null then
    insert into public.household_members (household_id, user_id, role)
    values (invited_household, new.id, 'member')
    on conflict (household_id, user_id) do nothing;

    update public.access_invites
    set accepted_at = now()
    where household_id = invited_household
      and lower(email) = lower(new.email)
      and accepted_at is null;

    return new;
  end if;

  insert into public.households (name, created_by)
  values ('Familia', new.id)
  returning id into new_household;

  insert into public.household_members (household_id, user_id, role)
  values (new_household, new.id, 'owner');

  insert into public.settings (household_id, payment_day, monthly_limit)
  values (new_household, 10, 3500);

  insert into public.billing_cycles (household_id, start_date, monthly_limit)
  values (new_household, current_date, 3500);

  insert into public.categories (household_id, name, created_by)
  select new_household, category_name, new.id
  from unnest(array['Mercado','Padaria','Amazon','Mercado Livre','Farmacia','Gasolina','Lazer','Restaurante']) as category_name;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.update_cycle_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.billing_cycles
  set total_spent = coalesce((select sum(value) from public.expenses where cycle_id = coalesce(new.cycle_id, old.cycle_id)), 0)
  where id = coalesce(new.cycle_id, old.cycle_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists expenses_total_after_change on public.expenses;
create trigger expenses_total_after_change
after insert or update or delete on public.expenses
for each row execute function public.update_cycle_total();

create or replace function public.invite_household_member_by_email(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
  current_household uuid;
begin
  select household_id into current_household
  from public.household_members
  where user_id = auth.uid()
  limit 1;

  if current_household is null then
    raise exception 'Familia nao encontrada para o usuario atual.';
  end if;

  insert into public.access_invites (household_id, email, invited_by)
  values (current_household, lower(target_email), auth.uid())
  on conflict (household_id, email) do update
  set invited_by = excluded.invited_by,
      accepted_at = null,
      created_at = now();

  select id into target_user
  from public.profiles
  where lower(email) = lower(target_email)
  limit 1;

  if target_user is not null then
    insert into public.household_members (household_id, user_id, role)
    values (current_household, target_user, 'member')
    on conflict (household_id, user_id) do nothing;

    update public.access_invites
    set accepted_at = now()
    where household_id = current_household
      and lower(email) = lower(target_email);
  end if;
end;
$$;

drop function if exists public.add_household_member_by_email(text);

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.access_invites enable row level security;
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.billing_cycles enable row level security;
alter table public.expenses enable row level security;
alter table public.installments enable row level security;
alter table public.bills enable row level security;
alter table public.bill_payments enable row level security;

drop policy if exists "profiles self read" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "households member read" on public.households;
drop policy if exists "households owner update" on public.households;
drop policy if exists "members read own households" on public.household_members;
drop policy if exists "members owner insert" on public.household_members;
drop policy if exists "invites member all" on public.access_invites;
drop policy if exists "settings member all" on public.settings;
drop policy if exists "categories member all" on public.categories;
drop policy if exists "cycles member all" on public.billing_cycles;
drop policy if exists "expenses member all" on public.expenses;
drop policy if exists "installments member all" on public.installments;
drop policy if exists "bills member all" on public.bills;
drop policy if exists "bill_payments member all" on public.bill_payments;

create policy "profiles self read" on public.profiles for select using (id = auth.uid());
create policy "profiles self update" on public.profiles for update using (id = auth.uid());

create policy "households member read" on public.households for select using (public.is_household_member(id));
create policy "households owner update" on public.households for update using (created_by = auth.uid());

create policy "members read own households" on public.household_members for select using (public.is_household_member(household_id));
create policy "members owner insert" on public.household_members for insert with check (public.is_household_member(household_id));
create policy "invites member all" on public.access_invites for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create policy "settings member all" on public.settings for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "categories member all" on public.categories for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "cycles member all" on public.billing_cycles for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "expenses member all" on public.expenses for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "installments member all" on public.installments for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "bills member all" on public.bills for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "bill_payments member all" on public.bill_payments for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
