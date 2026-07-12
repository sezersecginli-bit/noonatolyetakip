-- ============================================================
-- PDKS - İzin / Tatil Günü Eklentisi
-- Bu dosyayı Supabase SQL Editor'de çalıştırın.
-- ============================================================

create table if not exists leave_days (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid references employees(id) on delete cascade, -- NULL = herkes için (resmi tatil)
  work_date    date not null,
  leave_type   text not null default 'yillik_izin',
  -- olası değerler: resmi_tatil | yillik_izin | mazeret | hastalik | diger
  paid         boolean not null default true,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_leave_days_date on leave_days (work_date);
create index if not exists idx_leave_days_employee on leave_days (employee_id, work_date);

alter table leave_days enable row level security;
-- Diğer tablolarda olduğu gibi: sadece sunucu (service role) erişebilir.
