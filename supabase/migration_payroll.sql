-- ============================================================
-- PDKS - Bordro / Ücret Hesaplama Eklentisi
-- Bu dosyayı Supabase SQL Editor'de çalıştırın (schema.sql'den SONRA).
-- Mevcut employees tablosuna ücret alanları ekler.
-- ============================================================

alter table employees
  add column if not exists daily_wage numeric(10,2) not null default 0,
  add column if not exists overtime_hourly_rate numeric(10,2) not null default 0,
  add column if not exists early_leave_deduction_hourly numeric(10,2) not null default 0,
  add column if not exists weekend_multiplier numeric(4,2) not null default 1.5;

comment on column employees.daily_wage is 'Normal hafta içi günlük ücret (TL)';
comment on column employees.overtime_hourly_rate is 'Normal mesai saatini aşan her saat için ek ücret (TL)';
comment on column employees.early_leave_deduction_hourly is 'Erken çıkılan her saat için kesinti (TL)';
comment on column employees.weekend_multiplier is 'Hafta sonu günlük ücret çarpanı (varsayılan 1.5)';
