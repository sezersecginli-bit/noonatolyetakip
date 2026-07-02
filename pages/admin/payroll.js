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
function firstOfMonthStr() {
  const d = new Date();
  d.setDate(1);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(d);
}

const PRESETS = [
  { key: "weekly", label: "Son 7 gün", start: () => daysAgoStr(6), end: () => todayStr() },
  { key: "monthly", label: "Bu ay", start: () => firstOfMonthStr(), end: () => todayStr() },
  { key: "last30", label: "Son 30 gün", start: () => daysAgoStr(29), end: () => todayStr() },
];

function tl(n) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(n || 0);
}

export default function PayrollPage() {
  const [start, setStart] = useState(firstOfMonthStr());
  const [end, setEnd] = useState(todayStr());
  const [payroll, setPayroll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = async (s = start, e = end) => {
    setLoading(true);
    const res = await authedFetch(`/api/payroll?start=${s}&end=${e}`);
    const data = await res.json();
    setPayroll(data.payroll || []);
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

  const grandTotal = payroll.reduce((s, p) => s + p.total_pay, 0);

  const exportCsv = () => {
    const header = ["Ad Soyad", "Tarih", "Hafta Sonu", "Çalışılan Saat", "Mesai Saati", "Erken Çıkış", "Taban Ücret", "Mesai Ücreti", "Kesinti", "Günlük Toplam"];
    const lines = [header.join(";")];
    for (const p of payroll) {
      for (const d of p.days) {
        lines.push([
          p.full_name, d.work_date, d.weekend ? "Evet" : "Hayır",
          d.worked_hours, d.overtime_hours, d.is_early_leave ? "Evet" : "Hayır",
          d.base_pay, d.overtime_pay, d.deduction, d.total_pay,
        ].join(";"));
      }
      lines.push([p.full_name, "TOPLAM", "", "", "", "", "", "", "", p.total_pay].join(";"));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pdks_bordro_${start}_${end}.csv`;
    a.click();
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const detailRows = [];
    for (const p of payroll) {
      for (const d of p.days) {
        detailRows.push({
          "Ad Soyad": p.full_name,
          Tarih: d.work_date,
          "Hafta Sonu": d.weekend ? "Evet" : "Hayır",
          "Çalışılan Saat": d.worked_hours,
          "Mesai Saati": d.overtime_hours,
          "Erken Çıkış": d.is_early_leave ? "Evet" : "Hayır",
          "Taban Ücret": d.base_pay,
          "Mesai Ücreti": d.overtime_pay,
          Kesinti: d.deduction,
          "Günlük Toplam": d.total_pay,
        });
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "Günlük Detay");

    const summaryRows = payroll.map((p) => ({
      "Ad Soyad": p.full_name,
      "Çalışılan Gün": p.days_worked,
      "Toplam Ücret": p.total_pay,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Özet");

    XLSX.writeFile(wb, `pdks_bordro_${start}_${end}.xlsx`);
  };

  return (
    <AdminLayout>
      <Head><title>Bordro - PDKS</title></Head>

      <h1 className="font-display text-2xl font-semibold text-ink mb-2">Bordro</h1>
      <p className="text-sm text-ink/50 mb-6">
        Günlük ücret + hafta sonu çarpanı + mesai − erken çıkış kesintisi. Ücretler Personel
        sayfasından çalışan bazında ayarlanır.
      </p>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => applyPreset(p)}
            className="px-3 py-1.5 rounded-full text-sm font-medium bg-panel border border-line text-ink/70 hover:border-brand">
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
            Hesapla
          </button>
        </div>
      </div>

      {loaded && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-3">
              <button onClick={exportCsv} disabled={!payroll.length} className="rounded-full border border-line px-4 py-2 text-sm font-medium disabled:opacity-40">
                CSV indir
              </button>
              <button onClick={exportExcel} disabled={!payroll.length} className="rounded-full border border-line px-4 py-2 text-sm font-medium disabled:opacity-40">
                Excel indir
              </button>
            </div>
            <div className="bg-brand-light rounded-card px-4 py-2">
              <span className="text-xs text-brand-dark/70 mr-2">Toplam ödenecek:</span>
              <span className="font-display font-semibold text-brand-dark">{tl(grandTotal)}</span>
            </div>
          </div>

          <div className="bg-panel border border-line rounded-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-ink/50 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Ad Soyad</th>
                  <th className="text-left px-4 py-3 font-medium">Çalışılan Gün</th>
                  <th className="text-left px-4 py-3 font-medium">Toplam Ücret</th>
                  <th className="text-left px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-ink/40">Hesaplanıyor…</td></tr>
                ) : payroll.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-ink/40">Kayıt yok.</td></tr>
                ) : (
                  payroll.map((p) => (
                    <>
                      <tr key={p.employee_id} className="border-t border-line">
                        <td className="px-4 py-3 font-medium text-ink">{p.full_name}</td>
                        <td className="px-4 py-3">{p.days_worked}</td>
                        <td className="px-4 py-3 font-medium text-ink">{tl(p.total_pay)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setExpanded(expanded === p.employee_id ? null : p.employee_id)}
                            className="text-brand text-xs font-medium underline"
                          >
                            {expanded === p.employee_id ? "Gizle" : "Detay"}
                          </button>
                        </td>
                      </tr>
                      {expanded === p.employee_id && (
                        <tr key={p.employee_id + "-detail"} className="border-t border-line bg-canvas">
                          <td colSpan={4} className="px-4 py-3">
                            <table className="w-full text-xs">
                              <thead className="text-ink/50">
                                <tr>
                                  <th className="text-left py-1 font-medium">Tarih</th>
                                  <th className="text-left py-1 font-medium">Çalışılan</th>
                                  <th className="text-left py-1 font-medium">Mesai</th>
                                  <th className="text-left py-1 font-medium">Taban</th>
                                  <th className="text-left py-1 font-medium">Mesai Ücreti</th>
                                  <th className="text-left py-1 font-medium">Kesinti</th>
                                  <th className="text-left py-1 font-medium">Toplam</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.days.map((d) => (
                                  <tr key={d.work_date} className="border-t border-line/60">
                                    <td className="py-1.5">
                                      {d.work_date} {d.weekend && <span className="text-amber font-medium">(h.sonu)</span>}
                                    </td>
                                    <td className="py-1.5">{d.worked_hours} sa</td>
                                    <td className="py-1.5">{d.overtime_hours} sa</td>
                                    <td className="py-1.5">{tl(d.base_pay)}</td>
                                    <td className="py-1.5">{tl(d.overtime_pay)}</td>
                                    <td className="py-1.5 text-danger">{d.deduction > 0 ? "-" + tl(d.deduction) : "—"}</td>
                                    <td className="py-1.5 font-medium">{tl(d.total_pay)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
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
