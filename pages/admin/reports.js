import { useState } from "react";
import Head from "next/head";
import AdminLayout, { authedFetch } from "../../components/AdminLayout";

function todayStr() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(d);
}

const PRESETS = [
  { key: "daily", label: "Bugün", start: () => todayStr(), end: () => todayStr() },
  { key: "weekly", label: "Son 7 gün", start: () => daysAgoStr(6), end: () => todayStr() },
  { key: "monthly", label: "Son 30 gün", start: () => daysAgoStr(29), end: () => todayStr() },
];

export default function ReportsPage() {
  const [start, setStart] = useState(todayStr());
  const [end, setEnd] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async (s = start, e = end) => {
    setLoading(true);
    const res = await authedFetch(`/api/reports?start=${s}&end=${e}`);
    const data = await res.json();
    setRows(data.rows || []);
    setSummary(data.summary || []);
    setLoading(false);
    setLoaded(true);
  };

  const applyPreset = (preset) => {
    const s = preset.start();
    const e = preset.end();
    setStart(s);
    setEnd(e);
    load(s, e);
  };

  const exportCsv = () => {
    const header = ["Ad Soyad", "Tarih", "Tip", "Konum", "Saha Notu", "Saat", "Geç", "Erken Çıkış", "Süre (dk)"];
    const lines = [header.join(";")];
    for (const r of rows) {
      lines.push(
        [
          r.full_name,
          r.work_date,
          r.log_type,
          r.location,
          r.site_label,
          new Date(r.logged_at).toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul" }),
          r.is_late ? "Evet" : "Hayır",
          r.is_early_leave ? "Evet" : "Hayır",
          r.work_duration_min ?? "",
        ].join(";")
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pdks_rapor_${start}_${end}.csv`;
    a.click();
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const wsRows = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        "Ad Soyad": r.full_name,
        Departman: r.department,
        Tarih: r.work_date,
        Tip: r.log_type,
        Konum: r.location,
        "Saha Notu": r.site_label,
        Saat: new Date(r.logged_at).toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul" }),
        Geç: r.is_late ? "Evet" : "Hayır",
        "Erken Çıkış": r.is_early_leave ? "Evet" : "Hayır",
        "Süre (dk)": r.work_duration_min ?? "",
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsRows, "Hareketler");

    const wsSummary = XLSX.utils.json_to_sheet(
      summary.map((s) => ({
        "Ad Soyad": s.full_name,
        "Toplam Saat": s.total_hours,
        "Gün Sayısı": s.days_present,
        "Geç Kalma": s.late_count,
        "Erken Çıkış": s.early_leave_count,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsSummary, "Özet");

    XLSX.writeFile(wb, `pdks_rapor_${start}_${end}.xlsx`);
  };

  return (
    <AdminLayout>
      <Head><title>Raporlar - PDKS</title></Head>

      <h1 className="font-display text-2xl font-semibold text-ink mb-6">Raporlar</h1>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p)}
            className="px-3 py-1.5 rounded-full text-sm font-medium bg-panel border border-line text-ink/70 hover:border-brand"
          >
            {p.label}
          </button>
        ))}

        <div className="flex items-end gap-2 ml-2">
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Başlangıç</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg border border-line px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Bitiş</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-lg border border-line px-2 py-1.5 text-sm" />
          </div>
          <button onClick={() => load()} className="rounded-full bg-ink text-white text-sm font-medium px-4 py-2">
            Getir
          </button>
        </div>
      </div>

      {loaded && (
        <>
          <div className="flex gap-3 mb-4">
            <button onClick={exportCsv} disabled={!rows.length} className="rounded-full border border-line px-4 py-2 text-sm font-medium disabled:opacity-40">
              CSV indir
            </button>
            <button onClick={exportExcel} disabled={!rows.length} className="rounded-full border border-line px-4 py-2 text-sm font-medium disabled:opacity-40">
              Excel indir
            </button>
          </div>

          <h2 className="font-display text-lg font-semibold text-ink mb-2">Özet</h2>
          <div className="bg-panel border border-line rounded-card overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-ink/50 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Ad Soyad</th>
                  <th className="text-left px-4 py-3 font-medium">Toplam Saat</th>
                  <th className="text-left px-4 py-3 font-medium">Gün</th>
                  <th className="text-left px-4 py-3 font-medium">Geç Kalma</th>
                  <th className="text-left px-4 py-3 font-medium">Erken Çıkış</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.full_name} className="border-t border-line">
                    <td className="px-4 py-3 font-medium text-ink">{s.full_name}</td>
                    <td className="px-4 py-3">{s.total_hours} sa</td>
                    <td className="px-4 py-3">{s.days_present}</td>
                    <td className="px-4 py-3">{s.late_count}</td>
                    <td className="px-4 py-3">{s.early_leave_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="font-display text-lg font-semibold text-ink mb-2">Tüm Hareketler</h2>
          <div className="bg-panel border border-line rounded-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-ink/50 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Ad Soyad</th>
                  <th className="text-left px-4 py-3 font-medium">Tarih</th>
                  <th className="text-left px-4 py-3 font-medium">Tip</th>
                  <th className="text-left px-4 py-3 font-medium">Konum</th>
                  <th className="text-left px-4 py-3 font-medium">Saat</th>
                  <th className="text-left px-4 py-3 font-medium">Uyarı</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/40">Yükleniyor…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/40">Kayıt yok.</td></tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-4 py-3 font-medium text-ink">{r.full_name}</td>
                      <td className="px-4 py-3">{r.work_date}</td>
                      <td className="px-4 py-3">{r.log_type}</td>
                      <td className="px-4 py-3">
                        {r.location}
                        {r.site_label && <span className="text-ink/50"> ({r.site_label})</span>}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {new Date(r.logged_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" })}
                      </td>
                      <td className="px-4 py-3">
                        {r.is_late && <span className="text-danger text-xs font-medium mr-2">Geç</span>}
                        {r.is_early_leave && <span className="text-danger text-xs font-medium">Erken</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
