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
        istediğin gibi değiştirebilir, silebilir ya da yeni kayıt ekleyebilirsin.
      </p>

      <div className="bg-panel border border-line rounded-card p-4 mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
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
          {/* Mobil dahil her ekranda kart görünümü — yatay kaydırma gerektirmez */}
          <div className="space-y-3 mb-6">
            {loading ? (
              <p className="text-ink/40 text-sm text-center py-8">Yükleniyor…</p>
            ) : logs.length === 0 ? (
              <p className="text-ink/40 text-sm text-center py-8">Bu gün için kayıt yok.</p>
            ) : (
              logs.map((l) => (
                <div key={l.id} className="bg-panel border border-line rounded-card p-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-ink/60 mb-1">Tip</label>
                      <select
                        value={l.log_type}
                        onChange={(e) => changeType(l.id, e.target.value)}
                        className="w-full rounded-lg border border-line px-2 py-2 text-sm bg-panel"
                      >
                        <option value="in">Giriş</option>
                        <option value="out">Çıkış</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink/60 mb-1">Saat</label>
                      <input
                        type="time"
                        value={editTimes[l.id] || ""}
                        onChange={(e) => setEditTimes({ ...editTimes, [l.id]: e.target.value })}
                        className="w-full rounded-lg border border-line px-2 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-ink/50 mb-3">
                    <span>
                      {l.location === "saha" ? `Şantiye${l.site_label ? " (" + l.site_label + ")" : ""}` : "Atölye"}
                    </span>
                    <span>
                      {l.work_duration_min != null
                        ? `${Math.floor(l.work_duration_min / 60)}sa ${l.work_duration_min % 60}dk`
                        : "—"}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(l.id)}
                      className="flex-1 rounded-full bg-brand text-white text-sm font-medium py-2.5"
                    >
                      Kaydet
                    </button>
                    <button
                      onClick={() => removeLog(l.id)}
                      className="flex-1 rounded-full border border-danger/30 text-danger text-sm font-medium py-2.5"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-panel border border-brand/30 rounded-card p-4">
            <p className="font-medium text-ink text-sm mb-3">Yeni kayıt ekle</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Tip</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-panel"
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
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button onClick={addLog} className="w-full rounded-full bg-brand text-white text-sm font-medium py-2.5">
              Ekle
            </button>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
