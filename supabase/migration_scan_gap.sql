-- ============================================================
-- PDKS - Art Arda Okutma Koruması Ayarı
-- Bu dosyayı Supabase SQL Editor'de çalıştırın.
-- ============================================================

alter table work_settings
  add column if not exists min_scan_gap_seconds int not null default 120;

comment on column work_settings.min_scan_gap_seconds is 'Aynı personel için art arda okutmalar arasında beklenmesi gereken en az saniye';
