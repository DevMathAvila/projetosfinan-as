alter table public.bills
add column if not exists bill_type text not null default 'fixed';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'bills_value_check'
      and conrelid = 'public.bills'::regclass
  ) then
    alter table public.bills
    drop constraint bills_value_check;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bills_value_non_negative_check'
      and conrelid = 'public.bills'::regclass
  ) then
    alter table public.bills
    add constraint bills_value_non_negative_check check (value >= 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bills_bill_type_check'
      and conrelid = 'public.bills'::regclass
  ) then
    alter table public.bills
    add constraint bills_bill_type_check check (bill_type in ('fixed', 'variable'));
  end if;
end
$$;

update public.bills
set bill_type = 'variable'
where lower(trim(name)) in (
  'cpfl casa',
  'condominio ap',
  'condominio casa',
  'condominio apartamento',
  'condonimio ap',
  'condonimio casa',
  'condonimio apartamento',
  'condomínio ap',
  'condomínio casa',
  'condomínio apartamento'
);
