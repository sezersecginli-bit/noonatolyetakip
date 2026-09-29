import { useEffect, useState } from "react";
import Head from "next/head";
import AdminLayout, { authedFetch } from "../../components/AdminLayout";

const MONTH_NAMES = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

function pad(n) { return String(n).padStart(2, "0"); }
function monthRange(year, month) {
  const start = `${year}-${pad(month + 1)}-01`;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const end = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
  return { start, end };
}
function dayNum(dateStr) { return Number(dateStr.split("-")[2]); }
function weekdayShort(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  return ["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"][d.getUTCDay()];
}
function isWeekendStr(dateStr) {
  const wd = new Date(dateStr + "T12:00:00Z").getUTCDay();
  return wd === 0 || wd === 6;
}
function tl(n) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n || 0);
}

const CODE_STYLES = {
  W:  "bg-brand text-white",
  WH: "bg-amber text-white",
  O:  "bg-yellow-300 text-ink",
  H:  "bg-purple-200 text-purple-800",
  V:  "bg-blue-200 text-blue-800",
  S:  "bg-red-200 text-red-800",
  M:  "bg-gray-300 text-ink",
  "": "bg-line/30 text-ink/20",
};

export default function AttendanceGridPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [data, setData] = useState(null);
  const [payroll, setPayroll] = useState({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { start, end } = monthRange(year, month);
    const [gridRes, payrollRes] = await Promise.all([
      authedFetch(`/api/attendance-grid?start=${start}&end=${end}`),
      authedFetch(`/api/payroll?start=${start}&end=${end}`),
    ]);
    const gridJson = await gridRes.json();
    const payrollJson = await payrollRes.json();
    setData(gridRes.ok ? gridJson : null);
    const payMap = {};
    (payrollJson.payroll || []).forEach((p) => { payMap[p.employee_id] = p; });
    setPayroll(payMap);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year, month]);

  const changeMonth = (delta) => {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m); setYear(y);
  };

  const exportExcel = async () => {
    if (!data) return;
    const XLSX = await import("xlsx");
    const rows = data.employees.map((emp) => {
      const row = {
        "Personel": emp.full_name,
        "Toplam Mesai (sa)": data.cells[emp.id].__overtimeHours,
        "Departman": emp.department || "",
        "Günlük Ücret": emp.daily_wage,
      };
      data.days.forEach((d) => { row[dayNum(d)] = data.cells[emp.id][d].code || ""; });
      row["Çalışılan Gün"] = data.cells[emp.id].__workedDays;
      row["Toplam Ücret"] = payroll[emp.id]?.total_pay ?? "";
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${MONTH_NAMES[month]} ${year}`);
    XLSX.writeFile(wb, `devam_tablosu_${MONTH_NAMES[month]}_${year}.xlsx`);
  };

  return (
    <AdminLayout>
      <Head><title>Devam Tablosu - PDKS</title></Head>

      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">Devam Tablosu</h1>
        <button onClick={exportExcel} disabled={!data} className="rounded-full border border-line px-4 py-2 text-sm font-medium disabled:opacity-40">
          Excel indir
        </button>
      </div>
      <p className="text-sm text-ink/50 mb-6">
        Kimin hangi gün geldiğini, tam ay görünümünde, harf kodlarıyla tek bakışta gör. Bir günün
        üzerine gel/dokun, o günkü mesai saatini görürsün.
      </p>

      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => changeMonth(-1)} className="rounded-full border border-line w-8 h-8 text-ink/60">‹</button>
        <p className="font-display font-semibold text-ink w-40 text-center">{MONTH_NAMES[month]} {year}</p>
        <button onClick={() => changeMonth(1)} className="rounded-full border border-line w-8 h-8 text-ink/60">›</button>
        {loading && <span className="text-xs text-ink/40 ml-2">Yükleniyor…</span>}
      </div>

      {!data || data.employees.length === 0 ? (
        <p className="text-ink/40 text-sm">Veri yok.</p>
      ) : (
        <>
          <div className="bg-panel border border-line rounded-card overflow-x-auto">
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-panel text-left px-3 py-2 border-b border-r border-line font-medium text-ink/60 whitespace-nowrap z-10">Personel</th>
                  <th className="px-2 py-2 border-b border-line text-center font-medium text-ink/60 whitespace-nowrap bg-amber-light/30">Toplam Mesai (sa)</th>
                  <th className="text-left px-2 py-2 border-b border-line font-medium text-ink/60 whitespace-nowrap">Departman</th>
                  <th className="text-right px-2 py-2 border-b border-line font-medium text-ink/60 whitespace-nowrap">Günlük Ücret</th>
                  {data.days.map((d) => (
                    <th key={d} className={`px-1 py-2 border-b border-line text-center font-medium whitespace-nowrap ${isWeekendStr(d) ? "bg-amber-light/40 text-amber" : "text-ink/50"}`} style={{ minWidth: 30 }}>
                      <div className="text-[9px] leading-none">{weekdayShort(d)}</div>
                      <div className="text-xs leading-none mt-0.5">{dayNum(d)}</div>
                    </th>
                  ))}
                  <th className="px-2 py-2 border-b border-line text-center font-medium text-ink/60 whitespace-nowrap">Çalışılan Gün</th>
                  <th className="px-2 py-2 border-b border-line text-center font-medium text-ink/60 whitespace-nowrap">Toplam Ücret</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((emp) => {
                  const workedDays = data.cells[emp.id].__workedDays;
                  const overtimeHours = data.cells[emp.id].__overtimeHours;
                  const pay = payroll[emp.id];
                  return (
                    <tr key={emp.id} className="border-b border-line/60">
                      <td className="sticky left-0 bg-panel px-3 py-1.5 border-r border-line font-medium text-ink whitespace-nowrap z-10">{emp.full_name}</td>
                      <td className="px-2 py-1.5 text-center font-semibold text-amber bg-amber-light/20 whitespace-nowrap">
                        {overtimeHours > 0 ? `${overtimeHours} sa` : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-ink/60 whitespace-nowrap">{emp.department || "—"}</td>
                      <td className="px-2 py-1.5 text-right text-ink/60 whitespace-nowrap">{tl(emp.daily_wage)}</td>
                      {data.days.map((d) => {
                        const cell = data.cells[emp.id][d];
                        const title = [
                          cell.code === "W" ? "Çalıştı" : cell.code === "WH" ? "Hafta sonu çalıştı" :
                          cell.code === "O" ? "Mesai yaptı" : cell.code === "H" ? "Resmi tatil" :
                          cell.code === "V" ? "Yıllık izin" : cell.code === "S" ? "Hastalık" :
                          cell.code === "M" ? "Mazeret izni" : "Gelmedi",
                          cell.worked_hours ? `Toplam: ${cell.worked_hours} sa` : "",
                          cell.overtime_hours > 0 ? `Mesai: ${cell.overtime_hours} sa` : "",
                          cell.is_late ? "Geç" : "", cell.is_early_leave ? "Erken çıkış" : "",
                          cell.location === "saha" ? "Şantiye" : "",
                        ].filter(Boolean).join(" · ");
                        return (
                          <td key={d} className="p-0.5 text-center" title={`${emp.full_name} — ${d}: ${title}`}>
                            <div className={`mx-auto w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${CODE_STYLES[cell.code]} ${(cell.is_late || cell.is_early_leave) ? "ring-2 ring-danger" : ""}`}>
                              {cell.code}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-center font-medium text-ink">{workedDays}</td>
                      <td className="px-2 py-1.5 text-center font-medium text-brand-dark whitespace-nowrap">{pay ? tl(pay.total_pay) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-4 mt-4 text-xs text-ink/60">
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-brand inline-block" /> W — Çalıştı</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-amber inline-block" /> WH — Hafta sonu çalıştı</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-yellow-300 inline-block" /> O — Mesai</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-purple-200 inline-block" /> H — Resmi tatil</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-blue-200 inline-block" /> V — Yıllık izin</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-red-200 inline-block" /> S — Hastalık</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-gray-300 inline-block" /> M — Mazeret</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded ring-2 ring-danger inline-block" /> Geç / erken çıkış</span>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
