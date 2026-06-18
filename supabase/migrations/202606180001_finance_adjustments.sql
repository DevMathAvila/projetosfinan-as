alter table public.installments
add column if not exists notes text;

update public.settings
set payment_day = 10,
    updated_at = now()
where payment_day in (9, 15);

alter table public.bills
add column if not exists due_day integer;

update public.bills
set due_day = extract(day from due_date)::integer
where due_day is null;

alter table public.bills
alter column due_day set default 1;

alter table public.bills
alter column due_day set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bills_due_day_check'
      and conrelid = 'public.bills'::regclass
  ) then
    alter table public.bills
    add constraint bills_due_day_check check (due_day between 1 and 31);
  end if;
end
$$;

create index if not exists expenses_household_expense_date_idx
on public.expenses (household_id, expense_date);

create index if not exists bills_household_due_date_idx
on public.bills (household_id, due_date);

create index if not exists installments_household_active_start_date_idx
on public.installments (household_id, active, start_date);

create index if not exists access_invites_household_created_at_idx
on public.access_invites (household_id, created_at desc);
