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

function nowTimeStr() {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Istanbul",
  }).format(new Date());
}

export default function DashboardPage() {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [loadError, setLoadError] = useState("");

  const [manualOpen, setManualOpen] = useState(false);
  const [manualEmployee, setManualEmployee] = useState("");
  const [manualType, setManualType] = useState("out");
  const [manualTime, setManualTime] = useState(nowTimeStr());
  const [manualMsg, setManualMsg] = useState("");
  const [manualSaving, setManualSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [dashRes, notesRes] = await Promise.all([
        authedFetch(`/api/dashboard?date=${date}`),
        authedFetch(`/api/fieldnotes?date=${date}`),
      ]);
      const dashData = await dashRes.json();
      const notesData = await notesRes.json();

      if (!dashRes.ok) throw new Error(dashData.error || "Panel verisi alınamadı.");
      if (!notesRes.ok) throw new Error(notesData.error || "Saha notları alınamadı.");

      setRows(dashData.summary || []);
      setNotes(notesData.notes || []);
    } catch (err) {
      setLoadError(err.message || "Veri alınırken bir hata oluştu.");
      setRows([]);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const openManual = (employeeId, type) => {
    setManualEmployee(employeeId || "");
    setManualType(type || "out");
    setManualTime(nowTimeStr());
    setManualMsg("");
    setManualOpen(true);
  };

  const submitManual = async () => {
    if (!manualEmployee) {
      setManualMsg("Lütfen personel seçin.");
      return;
    }
    setManualSaving(true);
    setManualMsg("");
    try {
      const res = await authedFetch("/api/manuallog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: manualEmployee,
          work_date: date,
          log_type: manualType,
          time: manualTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setManualMsg(data.error || "Kaydedilemedi.");
      } else {
        setManualOpen(false);
        load();
      }
    } catch (err) {
      setManualMsg("Bağlantı hatası: " + err.message);
    } finally {
      setManualSaving(false);
    }
  };

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
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-line px-3 py-2 text-sm"
          />
          <button
            onClick={() => openManual(null, "out")}
            className="rounded-full bg-ink text-white text-sm font-medium px-4 py-2 whitespace-nowrap"
          >
            + Manuel kayıt
          </button>
        </div>
      </div>

      {manualOpen && (
        <div className="bg-panel border border-brand/30 rounded-card p-4 mb-6">
          <p className="font-medium text-ink text-sm mb-3">
        Manuel giriş/çıkış ekle — {fmtDate(date)}
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[180px]">
              <label className="block text-xs font-medium text-ink/60 mb-1">Personel</label>
              <select
                value={manualEmployee}
                onChange={(e) => setManualEmployee(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-panel"
              >
                <option value="">Seçiniz…</option>
                {rows.map((r) => (
                  <option key={r.employee_id} value={r.employee_id}>{r.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Tip</label>
              <select
                value={manualType}
                onChange={(e) => setManualType(e.target.value)}
                className="rounded-lg border border-line px-3 py-2 text-sm bg-panel"
              >
                <option value="in">Giriş</option>
                <option value="out">Çıkış</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Saat</label>
              <input
                type="time"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                className="rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={submitManual}
              disabled={manualSaving}
              className="rounded-full bg-brand text-white text-sm font-medium px-5 py-2 disabled:opacity-50"
            >
              {manualSaving ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <button
              onClick={() => setManualOpen(false)}
              className="text-ink/40 text-sm underline"
            >
              Vazgeç
            </button>
          </div>
          {manualMsg && <p className="text-danger text-sm mt-2">{manualMsg}</p>}
        </div>
      )}

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
        {loadError && (
          <p className="px-4 py-3 bg-danger/10 text-danger text-sm border-b border-danger/20">
            {loadError} — sayfayı yenilemeyi deneyin.
          </p>
        )}
        <table className="w-full text-sm">
          <thead className="bg-canvas text-ink/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Personel</th>
              <th className="text-left px-4 py-3 font-medium">Durum</th>
              <th className="text-left px-4 py-3 font-medium">Giriş</th>
              <th className="text-left px-4 py-3 font-medium">Çıkış</th>
              <th className="text-left px-4 py-3 font-medium">Uyarı</th>
              <th className="text-left px-4 py-3 font-medium">Süre</th>
              <th className="text-left px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-ink/40">Yükleniyor…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-ink/40">Kayıt bulunamadı.</td></tr>
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
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.status === "icerde" && (
                      <button
                        onClick={() => openManual(r.employee_id, "out")}
                        className="text-brand text-xs font-medium underline"
                      >
                        Çıkış işaretle
                      </button>
                    )}
                    {r.status === "gelmedi" && (
                      <button
                        onClick={() => openManual(r.employee_id, "in")}
                        className="text-brand text-xs font-medium underline"
                      >
                        Giriş işaretle
                      </button>
                    )}
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
