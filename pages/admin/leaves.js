import { useEffect, useState } from "react";
import Head from "next/head";
import AdminLayout, { authedFetch } from "../../components/AdminLayout";

const LEAVE_TYPES = [
  { value: "resmi_tatil", label: "Resmi Tatil" },
  { value: "yillik_izin", label: "Yıllık İzin" },
  { value: "mazeret", label: "Mazeret İzni" },
  { value: "hastalik", label: "Hastalık" },
  { value: "diger", label: "Diğer" },
];

function typeLabel(v) {
  return LEAVE_TYPES.find((t) => t.value === v)?.label || v;
}

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function todayStr() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

export default function LeavesPage() {
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [scope, setScope] = useState("company"); // company | personal
  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState(todayStr());
  const [days, setDays] = useState(1);
  const [leaveType, setLeaveType] = useState("yillik_izin");
  const [paid, setPaid] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [empRes, leaveRes] = await Promise.all([
      authedFetch("/api/employees"),
      authedFetch("/api/leaves"),
    ]);
    const empData = await empRes.json();
    const leaveData = await leaveRes.json();
    setEmployees((empData.employees || []).filter((e) => e.is_active));
    setLeaves(leaveData.leaves || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (scope === "personal" && !employeeId) {
      setError("Lütfen bir personel seçin.");
      return;
    }
    setSaving(true);
    try {
      const res = await authedFetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: scope === "personal" ? employeeId : null,
          start_date: startDate,
          days,
          leave_type: leaveType,
          paid,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kaydedilemedi.");
      } else {
        setNote("");
        setDays(1);
        load();
      }
    } catch (err) {
      setError("Bağlantı hatası: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Bu izin kaydı silinsin mi?")) return;
    await authedFetch("/api/leaves", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

  return (
    <AdminLayout>
      <Head><title>İzinler - PDKS</title></Head>

      <h1 className="font-display text-2xl font-semibold text-ink mb-2">İzinler ve Tatiller</h1>
      <p className="text-sm text-ink/50 mb-6">
        Resmi tatil tüm personeli, bireysel izin ise seçtiğin kişiyi kapsar. İzinli günler
        "gelmedi" sayılmaz ve bordroya (ücretliyse) günlük ücret olarak yansır.
      </p>

      <form onSubmit={submit} className="bg-panel border border-line rounded-card p-4 mb-6">
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setScope("company")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${scope === "company" ? "bg-ink text-white" : "bg-canvas border border-line text-ink/60"}`}
          >
            Resmi Tatil (herkes)
          </button>
          <button
            type="button"
            onClick={() => setScope("personal")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${scope === "personal" ? "bg-ink text-white" : "bg-canvas border border-line text-ink/60"}`}
          >
            Bireysel İzin
          </button>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {scope === "personal" && (
            <div className="min-w-[180px]">
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
          )}

          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Başlangıç tarihi</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>

          <div className="w-[90px]">
            <label className="block text-xs font-medium text-ink/60 mb-1">Kaç gün</label>
            <input
              type="number"
              min="1"
              max="60"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>

          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-ink/60 mb-1">Tip</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-panel"
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Ücretli
          </label>

          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-ink/60 mb-1">Not (opsiyonel)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              placeholder="Ör. Ramazan Bayramı"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-brand text-white text-sm font-medium px-5 py-2 disabled:opacity-50"
          >
            {saving ? "Kaydediliyor…" : "Ekle"}
          </button>
        </div>
        {error && <p className="text-danger text-sm mt-3">{error}</p>}
      </form>

      <div className="bg-panel border border-line rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-ink/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Kapsam</th>
              <th className="text-left px-4 py-3 font-medium">Tarih</th>
              <th className="text-left px-4 py-3 font-medium">Tip</th>
              <th className="text-left px-4 py-3 font-medium">Ücretli</th>
              <th className="text-left px-4 py-3 font-medium">Not</th>
              <th className="text-right px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/40">Yükleniyor…</td></tr>
            ) : leaves.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/40">Kayıtlı izin/tatil yok.</td></tr>
            ) : (
              leaves.map((l) => (
                <tr key={l.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-ink">{l.full_name}</td>
                  <td className="px-4 py-3">{fmtDate(l.work_date)}</td>
                  <td className="px-4 py-3">{typeLabel(l.leave_type)}</td>
                  <td className="px-4 py-3">{l.paid ? "Evet" : "Hayır"}</td>
                  <td className="px-4 py-3 text-ink/60">{l.note || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(l.id)} className="text-danger text-xs font-medium underline">
                      Sil
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
