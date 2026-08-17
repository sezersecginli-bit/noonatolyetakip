import { useEffect, useState } from "react";
import Head from "next/head";
import AdminLayout, { authedFetch } from "../../components/AdminLayout";
import { getCurrentPosition } from "../../lib/geo";

export default function SettingsPage() {
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await authedFetch("/api/settings");
    const data = await res.json();
    setS(data.settings);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    const res = await authedFetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    setSaving(false);
    if (res.ok) {
      setMsg("Ayarlar kaydedildi.");
    } else {
      setMsg("Kaydedilemedi.");
    }
  };

  const useCurrentLocation = async () => {
    try {
      const pos = await getCurrentPosition();
      setS({ ...s, workplace_lat: pos.lat, workplace_lng: pos.lng });
      setMsg("Mevcut konum işyeri olarak ayarlandı (henüz kaydedilmedi).");
    } catch (err) {
      setMsg("Konum alınamadı: " + err.message);
    }
  };

  if (loading || !s) {
    return (
      <AdminLayout>
        <p className="text-ink/40 text-sm">Yükleniyor…</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Head><title>Ayarlar - PDKS</title></Head>
      <h1 className="font-display text-2xl font-semibold text-ink mb-6">Ayarlar</h1>

      <form onSubmit={save} className="max-w-xl space-y-8">
        <section className="bg-panel border border-line rounded-card p-5">
          <h2 className="font-display font-semibold text-ink mb-4">Mesai Saatleri</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Başlangıç</label>
              <input type="time" value={s.work_start} onChange={(e) => setS({ ...s, work_start: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Bitiş</label>
              <input type="time" value={s.work_end} onChange={(e) => setS({ ...s, work_end: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Geç kalma toleransı (dk)</label>
              <input type="number" min="0" value={s.late_tolerance_minutes}
                onChange={(e) => setS({ ...s, late_tolerance_minutes: Number(e.target.value) })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Erken çıkış toleransı (dk)</label>
              <input type="number" min="0" value={s.early_leave_tolerance_min}
                onChange={(e) => setS({ ...s, early_leave_tolerance_min: Number(e.target.value) })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        <section className="bg-panel border border-line rounded-card p-5">
          <h2 className="font-display font-semibold text-ink mb-4">Art Arda Okutma Koruması</h2>
          <p className="text-xs text-ink/50 mb-4">
            Bir çalışan yanlışlıkla art arda okutursa (kamera hatası, yanlış tıklama vb.)
            sistem bu süre dolmadan yeni bir giriş/çıkış kaydı oluşturmaz. Bu, "hemen giriş
            arkasından çıkış" gibi hatalı kayıtları önler.
          </p>
          <div className="max-w-[220px]">
            <label className="block text-xs font-medium text-ink/60 mb-1">
              Minimum bekleme süresi (saniye)
            </label>
            <input
              type="number"
              min="0"
              step="10"
              value={s.min_scan_gap_seconds ?? 120}
              onChange={(e) => setS({ ...s, min_scan_gap_seconds: Number(e.target.value) })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
            <p className="text-xs text-ink/40 mt-1">
              Örn. 120 = 2 dakika, 300 = 5 dakika. 0 girersen koruma tamamen kapanır.
            </p>
          </div>
        </section>

        <section className="bg-panel border border-line rounded-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-ink">Konum Doğrulama (GPS)</h2>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.geo_required}
                onChange={(e) => setS({ ...s, geo_required: e.target.checked })} />
              Zorunlu kıl
            </label>
          </div>
          <p className="text-xs text-ink/50 mb-4">
            Etkinleştirilirse personel yalnızca aşağıda tanımlı işyeri konumunun belirtilen
            yarıçapı içindeyken QR okutabilir.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Enlem (lat)</label>
              <input type="number" step="any" value={s.workplace_lat ?? ""}
                onChange={(e) => setS({ ...s, workplace_lat: e.target.value ? Number(e.target.value) : null })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Boylam (lng)</label>
              <input type="number" step="any" value={s.workplace_lng ?? ""}
                onChange={(e) => setS({ ...s, workplace_lng: e.target.value ? Number(e.target.value) : null })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-ink/60 mb-1">İzin verilen yarıçap (metre)</label>
              <input type="number" min="10" value={s.geo_radius_meters}
                onChange={(e) => setS({ ...s, geo_radius_meters: Number(e.target.value) })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
            </div>
            <button type="button" onClick={useCurrentLocation}
              className="mt-5 rounded-full border border-line px-4 py-2 text-sm font-medium whitespace-nowrap">
              Mevcut konumu kullan
            </button>
          </div>
        </section>

        {msg && <p className="text-sm text-brand">{msg}</p>}

        <button type="submit" disabled={saving}
          className="rounded-full bg-brand text-white font-medium px-6 py-2.5 disabled:opacity-50">
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </form>
    </AdminLayout>
  );
}
