update public.bills b
set paid = true
where b.due_date >= date '2026-08-01'
  and b.due_date < date '2026-09-01'
  and exists (
    select 1
    from public.bill_payments bp
    where bp.bill_id = b.id
      and bp.payment_date >= date '2026-07-01'
      and bp.payment_date < date '2026-08-01'
  );
