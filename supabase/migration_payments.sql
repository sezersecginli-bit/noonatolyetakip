-- ============================================================
-- PDKS - Ödeme Takibi Eklentisi
-- Bu dosyayı Supabase SQL Editor'de çalıştırın.
-- Yöneticinin her personele yaptığı ödemeleri not düşebilmesi
-- ve bordro üzerinden "ödendi / kaldı" takibi yapabilmesi için.
-- ============================================================

create table if not exists payments (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id) on delete cascade,
  amount        numeric(10,2) not null,
  payment_date  date not null default (now() at time zone 'Europe/Istanbul')::date,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_payments_employee_date on payments (employee_id, payment_date);

alter table payments enable row level security;
-- Diğer tablolarda olduğu gibi: sadece sunucu (service role) erişebilir.
