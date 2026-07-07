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

update public.bills
set
  paid = false,
  due_date = make_date(
    extract(year from due_date)::integer,
    extract(month from due_date)::integer + 1,
    least(
      due_day,
      extract(day from (
        date_trunc('month', due_date + interval '1 month')
        + interval '1 month'
        - interval '1 day'
      ))::integer
    )
  ),
  value = case when bill_type = 'variable' then 0 else value end
where paid = true
  and due_date >= date '2026-07-01'
  and due_date < date '2026-08-01';
