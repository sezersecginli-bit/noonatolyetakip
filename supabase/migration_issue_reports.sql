-- ============================================================
-- PDKS - Çalışma Süresi Hata Bildirimi Eklentisi
-- Bu dosyayı Supabase SQL Editor'de çalıştırın.
-- Çalışan, çıkış yaptığında gösterilen süreyi yanlış bulursa
-- anında bir not bırakabilir; yönetici panelinde bu notlar listelenir.
-- ============================================================

create table if not exists issue_reports (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees(id) on delete cascade,
  work_date    date not null,
  note         text,
  resolved     boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_issue_reports_resolved on issue_reports (resolved, created_at);

alter table issue_reports enable row level security;
-- Diğer tablolarda olduğu gibi: sadece sunucu (service role) erişebilir.
