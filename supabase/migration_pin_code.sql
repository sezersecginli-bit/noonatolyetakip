-- ============================================================
-- PDKS - Özet Ekranı PIN Kodu
-- Bu dosyayı Supabase SQL Editor'de çalıştırın.
-- Çalışanların "Aylık Özetim" ekranına QR okutmadan, admin'in
-- belirlediği bir PIN ile girebilmesi için.
-- ============================================================

alter table employees
  add column if not exists pin_code text;

comment on column employees.pin_code is 'Aylık özet ekranına giriş için PIN kodu (admin belirler, opsiyonel)';
