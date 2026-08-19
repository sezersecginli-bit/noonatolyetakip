import { useEffect, useState } from "react";
import Head from "next/head";
import AdminLayout, { authedFetch } from "../../components/AdminLayout";

const DAY_NAMES = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function pad(n) { return String(n).padStart(2, "0"); }
function toDateStr(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

function buildMonthGrid(year, month) {
  // month: 0-11. Pazartesi başlangıçlı takvim.
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const startWeekday = (firstOfMonth.getUTCDay() + 6) % 7; // 0=Pazartesi
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

export default function BulkEntryPage() {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [timeIn, setTimeIn] = useState("09:00");
  const [timeOut, setTimeOut] = useState("18:00");
  const [addIn, setAddIn] = useState(true);
  const [addOut, setAddOut] = useState(true);
  const [location, setLocation] = useState("atolye");

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDates, setSelectedDates] = useState(new Set());

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    authedFetch("/api/employees")
      .then((r) => r.json())
      .then((d) => setEmployees((d.employees || []).filter((e) => e.is_active)));
    authedFetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings?.work_start) setTimeIn(d.settings.work_start.slice(0, 5));
        if (d.settings?.work_end) setTimeOut(d.settings.work_end.slice(0, 5));
      });
  }, []);

  const toggleDate = (dateStr) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  const selectAllWeekdays = () => {
    const cells = buildMonthGrid(viewYear, viewMonth);
    const next = new Set(selectedDates);
    cells.forEach((d) => {
      if (!d) return;
      const dateObj = new Date(Date.UTC(viewYear, viewMonth, d));
      const weekday = dateObj.getUTCDay(); // 0=Pazar, 6=Cumartesi
      if (weekday !== 0 && weekday !== 6) next.add(toDateStr(viewYear, viewMonth, d));
    });
    setSelectedDates(next);
  };

  const clearSelection = () => setSelectedDates(new Set());

  const changeMonth = (delta) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  };

  const submit = async () => {
    setMsg("");
    if (!employeeId) { setMsg("Lütfen personel seçin."); return; }
    if (selectedDates.size === 0) { setMsg("Lütfen takvimden en az bir gün seçin."); return; }
    if (!addIn && !addOut) { setMsg("Giriş ya da çıkıştan en az birini işaretleyin."); return; }

    setSaving(true);
    try {
      const res = await authedFetch("/api/bulkentry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          dates: Array.from(selectedDates).sort(),
          time_in: addIn ? timeIn : null,
          time_out: addOut ? timeOut : null,
          location,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Kaydedilemedi.");
      } else {
        setMsg(`${data.days} gün için ${data.created} kayıt eklendi.`);
        setSelectedDates(new Set());
      }
    } catch (err) {
      setMsg("Bağlantı hatası: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const cells = buildMonthGrid(viewYear, viewMonth);
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <AdminLayout>
      <Head><title>Toplu Kayıt - PDKS</title></Head>

      <h1 className="font-display text-2xl font-semibold text-ink mb-2">Toplu Giriş/Çıkış Ekle</h1>
      <p className="text-sm text-ink/50 mb-6">
        Takvimden birden fazla gün seç, tek bir giriş/çıkış saati belirle — hepsine aynı anda
        uygulanır. Sonradan tek tek düzeltmek istersen "Gün Düzenle" sayfasını kullanabilirsin.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-panel border border-line rounded-card p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => changeMonth(-1)} className="rounded-full border border-line w-8 h-8 text-ink/60">‹</button>
            <p className="font-display font-semibold text-ink">{MONTH_NAMES[viewMonth]} {viewYear}</p>
            <button onClick={() => changeMonth(1)} className="rounded-full border border-line w-8 h-8 text-ink/60">›</button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-xs text-ink/40 font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const dateStr = toDateStr(viewYear, viewMonth, d);
              const isSelected = selectedDates.has(dateStr);
              const isToday = dateStr === todayStr;
              return (
                <button
                  key={i}
                  onClick={() => toggleDate(dateStr)}
                  className={`aspect-square rounded-lg text-sm font-medium transition ${
                    isSelected
                      ? "bg-brand text-white"
                      : isToday
                      ? "bg-brand-light text-brand-dark"
                      : "bg-canvas text-ink hover:bg-brand-light"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={selectAllWeekdays} className="text-xs font-medium text-brand underline">
              Bu ayın hafta içi günlerini seç
            </button>
            <button onClick={clearSelection} className="text-xs font-medium text-ink/40 underline">
              Seçimi temizle
            </button>
          </div>
          <p className="text-xs text-ink/50 mt-2">{selectedDates.size} gün seçili</p>
        </div>

        <div className="bg-panel border border-line rounded-card p-4 space-y-4 h-fit">
          <div>
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

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="flex items-center gap-2 text-xs font-medium text-ink/60 mb-1">
                <input type="checkbox" checked={addIn} onChange={(e) => setAddIn(e.target.checked)} />
                Giriş saati
              </label>
              <input
                type="time"
                value={timeIn}
                onChange={(e) => setTimeIn(e.target.value)}
                disabled={!addIn}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-40"
              />
            </div>
            <div className="flex-1">
              <label className="flex items-center gap-2 text-xs font-medium text-ink/60 mb-1">
                <input type="checkbox" checked={addOut} onChange={(e) => setAddOut(e.target.checked)} />
                Çıkış saati
              </label>
              <input
                type="time"
                value={timeOut}
                onChange={(e) => setTimeOut(e.target.value)}
                disabled={!addOut}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Konum</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-panel"
            >
              <option value="atolye">Atölye</option>
              <option value="saha">Şantiye</option>
            </select>
          </div>

          <button
            onClick={submit}
            disabled={saving}
            className="w-full rounded-full bg-brand text-white font-medium py-3 disabled:opacity-50"
          >
            {saving ? "Kaydediliyor…" : `${selectedDates.size} güne uygula`}
          </button>

          {msg && <p className="text-sm text-danger">{msg}</p>}
        </div>
      </div>
    </AdminLayout>
  );
}
