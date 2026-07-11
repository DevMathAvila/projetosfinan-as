update public.billing_cycles bc
set start_date = date '2026-07-11'
from public.settings s
where bc.household_id = s.household_id
  and bc.closed = false
  and s.payment_day = 11
  and bc.start_date = date '2026-08-11';

update public.installments
set current_installment = 2,
    active = true
where lower(trim(name)) = 'mercado livre'
  and total_installments = 3
  and total_value between 476.18 and 476.20;

update public.installments
set current_installment = 2,
    active = true
where lower(trim(name)) = 'mercado livre'
  and total_installments = 3
  and total_value between 66.68 and 66.70;

update public.installments
set current_installment = 2,
    installment_value = 208.33,
    total_value = 2499.96,
    active = true
where lower(trim(name)) in ('decoracao', 'decoração')
  and total_installments = 12;

update public.installments
set current_installment = 1,
    installment_value = 67.10,
    total_value = 268.40,
    active = true
where lower(trim(name)) = 'velas'
  and total_installments = 4;

update public.installments
set current_installment = 3,
    active = true
where lower(trim(name)) = 'buffet'
  and total_installments = 12;

update public.installments
set current_installment = 5,
    active = true
where lower(trim(name)) = 'hbo'
  and total_installments = 12;

update public.installments
set current_installment = 6,
    active = true
where lower(trim(name)) = 'notebook'
  and total_installments = 10;

update public.installments
set current_installment = 3,
    active = true
where lower(trim(name)) = 'amazon'
  and total_installments = 3;

update public.installments
set current_installment = 3,
    active = true
where lower(trim(name)) in ('boticario', 'boticário')
  and total_installments = 3;

update public.installments
set current_installment = total_installments + 1,
    active = false
where lower(trim(name)) in ('fatura cartao', 'fatura cartão')
  and total_installments = 3;
