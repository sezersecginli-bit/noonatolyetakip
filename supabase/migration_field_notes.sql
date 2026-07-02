-- ============================================================
-- PDKS - Saha / Montaj Notu Eklentisi
-- Bu dosyayı Supabase SQL Editor'de çalıştırın.
-- Çalışanların işyeri dışında (saha/montaj) olduğu günler için
-- GPS kontrolüne takılmadan not düşebilmelerini sağlar.
-- ============================================================

create table if not exists field_notes (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees(id) on delete cascade,
  work_date    date not null default (now() at time zone 'Europe/Istanbul')::date,
  note         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_field_notes_date on field_notes (work_date);
create index if not exists idx_field_notes_employee on field_notes (employee_id, work_date);

alter table field_notes enable row level security;
-- Diğer tablolarda olduğu gibi: sadece sunucu (service role) erişebilir.
