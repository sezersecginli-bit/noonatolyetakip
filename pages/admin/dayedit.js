import { useEffect, useState } from "react";
import Head from "next/head";
import AdminLayout, { authedFetch } from "../../components/AdminLayout";

function todayStr() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

function timeOf(iso) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export default function DayEditPage() {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");

  const [newType, setNewType] = useState("in");
  const [newTime, setNewTime] = useState("09:00");

  const [editTimes, setEditTimes] = useState({}); // { [id]: "HH:MM" }

  useEffect(() => {
    authedFetch("/api/employees")
      .then((r) => r.json())
      .then((d) => setEmployees((d.employees || []).filter((e) => e.is_active)));
  }, []);

  const load = async () => {
    if (!employeeId || !date) return;
    setLoading(true);
    setMsg("");
    const res = await authedFetch(`/api/daylogs?employee_id=${employeeId}&work_date=${date}`);
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Yüklenemedi.");
      setLogs([]);
    } else {
      setLogs(data.logs || []);
      const times = {};
      (data.logs || []).forEach((l) => (times[l.id] = timeOf(l.logged_at)));
      setEditTimes(times);
    }
    setLoading(false);
    setLoaded(true);
  };

  const saveEdit = async (id) => {
    setMsg("");
    const res = await authedFetch("/api/daylogs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, time: editTimes[id] }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error || "Kaydedilemedi.");
    else load();
  };

  const changeType = async (id, log_type) => {
    setMsg("");
    const res = await authedFetch("/api/daylogs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, time: editTimes[id], log_type }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error || "Kaydedilemedi.");
    else load();
  };

  const removeLog = async (id) => {
    if (!confirm("Bu kayıt silinsin mi?")) return;
    setMsg("");
    const res = await authedFetch("/api/daylogs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error || "Silinemedi.");
    else load();
  };

  const addLog = async () => {
    setMsg("");
    const res = await authedFetch("/api/daylogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: employeeId, work_date: date, log_type: newType, time: newTime }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error || "Eklenemedi.");
    else load();
  };

  return (
    <AdminLayout>
      <Head><title>Gün Düzenle - PDKS</title></Head>

      <h1 className="font-display text-2xl font-semibold text-ink mb-2">Gün Düzenle</h1>
      <p className="text-sm text-ink/50 mb-6">
        Bir çalışanın belirli bir gündeki tüm giriş/çıkış kayıtlarını görüp, saatlerini
        istediğin gibi değiştirebilir, silebilir ya da yeni kayıt ekleyebilirsin. Hiçbir
        sıralama kısıtlaması yok — tam kontrol sende.
      </p>

      <div className="bg-panel border border-line rounded-card p-4 mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-ink/60 mb-1">Personel</label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-panel"
          >
            <option value="">Seçiniz…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.full_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink/60 mb-1">Tarih</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={load}
          disabled={!employeeId}
          className="rounded-full bg-ink text-white text-sm font-medium px-5 py-2 disabled:opacity-40"
        >
          Yükle
        </button>
      </div>

      {msg && <p className="text-danger text-sm mb-4">{msg}</p>}

      {loaded && (
        <>
          <div className="bg-panel border border-line rounded-card overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-ink/50 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Tip</th>
                  <th className="text-left px-4 py-3 font-medium">Saat</th>
                  <th className="text-left px-4 py-3 font-medium">Konum</th>
                  <th className="text-left px-4 py-3 font-medium">Süre</th>
                  <th className="text-right px-4 py-3 font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-ink/40">Yükleniyor…</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-ink/40">Bu gün için kayıt yok.</td></tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} className="border-t border-line">
                      <td className="px-4 py-3">
                        <select
                          value={l.log_type}
                          onChange={(e) => changeType(l.id, e.target.value)}
                          className="rounded-lg border border-line px-2 py-1.5 text-sm bg-panel"
                        >
                          <option value="in">Giriş</option>
                          <option value="out">Çıkış</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="time"
                          value={editTimes[l.id] || ""}
                          onChange={(e) => setEditTimes({ ...editTimes, [l.id]: e.target.value })}
                          className="rounded-lg border border-line px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-ink/60">
                        {l.location === "saha" ? `Şantiye${l.site_label ? " (" + l.site_label + ")" : ""}` : "Atölye"}
                      </td>
                      <td className="px-4 py-3 text-ink/60">
                        {l.work_duration_min != null
                          ? `${Math.floor(l.work_duration_min / 60)}sa ${l.work_duration_min % 60}dk`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                        <button onClick={() => saveEdit(l.id)} className="text-brand text-xs font-medium underline">
                          Kaydet
                        </button>
                        <button onClick={() => removeLog(l.id)} className="text-danger text-xs font-medium underline">
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-panel border border-brand/30 rounded-card p-4">
            <p className="font-medium text-ink text-sm mb-3">Yeni kayıt ekle</p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Tip</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
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
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="rounded-lg border border-line px-3 py-2 text-sm"
                />
              </div>
              <button onClick={addLog} className="rounded-full bg-brand text-white text-sm font-medium px-5 py-2">
                Ekle
              </button>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
