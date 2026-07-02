import { useEffect, useState } from "react";
import Head from "next/head";
import AdminLayout, { authedFetch } from "../../components/AdminLayout";
import StatusBadge from "../../components/StatusBadge";

function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function todayStr() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

export default function DashboardPage() {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    const [dashRes, notesRes] = await Promise.all([
      authedFetch(`/api/dashboard?date=${date}`),
      authedFetch(`/api/fieldnotes?date=${date}`),
    ]);
    const dashData = await dashRes.json();
    const notesData = await notesRes.json();
    setRows(dashData.summary || []);
    setNotes(notesData.notes || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "gec") return r.is_late;
    if (filter === "erken") return r.is_early_leave;
    return r.status === filter;
  });

  const counts = {
    toplam: rows.length,
    icerde: rows.filter((r) => r.status === "icerde").length,
    cikti: rows.filter((r) => r.status === "cikti").length,
    gelmedi: rows.filter((r) => r.status === "gelmedi").length,
    gec: rows.filter((r) => r.is_late).length,
    erken: rows.filter((r) => r.is_early_leave).length,
  };

  return (
    <AdminLayout>
      <Head>
        <title>Panel - PDKS</title>
      </Head>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Günlük Personel Durumu</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          ["toplam", "Toplam personel", "all"],
          ["icerde", "İçeride", "icerde"],
          ["cikti", "Çıktı", "cikti"],
          ["gelmedi", "Gelmedi", "gelmedi"],
          ["gec", "Geç kalan", "gec"],
          ["erken", "Erken çıkan", "erken"],
        ].map(([key, label, f]) => (
          <button
            key={key}
            onClick={() => setFilter(f)}
            className={`text-left rounded-card border p-3 transition ${
              filter === f ? "border-brand bg-brand-light" : "border-line bg-panel hover:border-brand/40"
            }`}
          >
            <p className="text-2xl font-display font-semibold text-ink">{counts[key]}</p>
            <p className="text-xs text-ink/60">{label}</p>
          </button>
        ))}
      </div>

      <div className="bg-panel border border-line rounded-card overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-ink/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Personel</th>
              <th className="text-left px-4 py-3 font-medium">Durum</th>
              <th className="text-left px-4 py-3 font-medium">Giriş</th>
              <th className="text-left px-4 py-3 font-medium">Çıkış</th>
              <th className="text-left px-4 py-3 font-medium">Uyarı</th>
              <th className="text-left px-4 py-3 font-medium">Süre</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/40">Yükleniyor…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/40">Kayıt bulunamadı.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.employee_id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-ink">{r.full_name}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 font-mono">{fmtTime(r.check_in)}</td>
                  <td className="px-4 py-3 font-mono">{fmtTime(r.check_out)}</td>
                  <td className="px-4 py-3">
                    {r.is_late && <span className="text-danger text-xs font-medium mr-2">Geç</span>}
                    {r.is_early_leave && <span className="text-danger text-xs font-medium">Erken çıkış</span>}
                  </td>
                  <td className="px-4 py-3 text-ink/60">
                    {r.work_duration_min != null
                      ? `${Math.floor(r.work_duration_min / 60)}sa ${r.work_duration_min % 60}dk`
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="font-display text-lg font-semibold text-ink mb-3">Saha / Montaj Notları</h2>
      <div className="bg-panel border border-line rounded-card overflow-hidden">
        {notes.length === 0 ? (
          <p className="px-4 py-6 text-center text-ink/40 text-sm">Bu tarih için saha notu yok.</p>
        ) : (
          <ul className="divide-y divide-line">
            {notes.map((n) => (
              <li key={n.id} className="px-4 py-3 text-sm">
                <span className="font-medium text-ink">{n.full_name}</span>
                <span className="text-ink/50"> — {fmtDate(n.work_date)} tarihinde: </span>
                <span className="text-ink">"{n.note}"</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminLayout>
  );
}
