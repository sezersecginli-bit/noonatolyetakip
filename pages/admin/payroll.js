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
function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
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

  const [paymentFormFor, setPaymentFormFor] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayStr());
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState("");

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
  const grandPaid = payroll.reduce((s, p) => s + p.total_paid, 0);
  const grandRemaining = payroll.reduce((s, p) => s + p.remaining, 0);

  const openPaymentForm = (employeeId) => {
    setPaymentFormFor(employeeId);
    setPaymentAmount("");
    setPaymentDate(todayStr());
    setPaymentNote("");
    setPaymentMsg("");
  };

  const submitPayment = async (employeeId) => {
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setPaymentMsg("Lütfen geçerli bir tutar girin.");
      return;
    }
    setPaymentSaving(true);
    setPaymentMsg("");
    try {
      const res = await authedFetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          amount: paymentAmount,
          payment_date: paymentDate,
          note: paymentNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPaymentMsg(data.error || "Kaydedilemedi.");
      } else {
        setPaymentFormFor(null);
        load();
      }
    } catch (err) {
      setPaymentMsg("Bağlantı hatası: " + err.message);
    } finally {
      setPaymentSaving(false);
    }
  };

  const removePayment = async (id) => {
    if (!confirm("Bu ödeme kaydı silinsin mi?")) return;
    await authedFetch("/api/payments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

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
      lines.push([p.full_name, "TOPLAM HAK EDİLEN", "", "", "", "", "", "", "", p.total_pay].join(";"));
      lines.push([p.full_name, "TOPLAM ÖDENEN", "", "", "", "", "", "", "", p.total_paid].join(";"));
      lines.push([p.full_name, "KALAN", "", "", "", "", "", "", "", p.remaining].join(";"));
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
      "Hak Edilen": p.total_pay,
      "Ödenen": p.total_paid,
      "Kalan": p.remaining,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Özet");

    const paymentRows = [];
    for (const p of payroll) {
      for (const pay of p.payments) {
        paymentRows.push({
          "Ad Soyad": p.full_name,
          Tarih: pay.payment_date,
          Tutar: pay.amount,
          Not: pay.note || "",
        });
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentRows), "Ödemeler");

    XLSX.writeFile(wb, `pdks_bordro_${start}_${end}.xlsx`);
  };

  return (
    <AdminLayout>
      <Head><title>Bordro - PDKS</title></Head>

      <h1 className="font-display text-2xl font-semibold text-ink mb-2">Bordro</h1>
      <p className="text-sm text-ink/50 mb-6">
        Günlük ücret + hafta sonu çarpanı + mesai − erken çıkış kesintisi + izin günleri.
        Yaptığın ödemeleri not düşerek kalan bakiyeyi takip edebilirsin.
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
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex gap-3">
              <button onClick={exportCsv} disabled={!payroll.length} className="rounded-full border border-line px-4 py-2 text-sm font-medium disabled:opacity-40">
                CSV indir
              </button>
              <button onClick={exportExcel} disabled={!payroll.length} className="rounded-full border border-line px-4 py-2 text-sm font-medium disabled:opacity-40">
                Excel indir
              </button>
            </div>
            <div className="flex gap-2">
              <div className="bg-brand-light rounded-card px-4 py-2">
                <span className="text-xs text-brand-dark/70 mr-2">Hak edilen:</span>
                <span className="font-display font-semibold text-brand-dark">{tl(grandTotal)}</span>
              </div>
              <div className="bg-canvas border border-line rounded-card px-4 py-2">
                <span className="text-xs text-ink/50 mr-2">Ödenen:</span>
                <span className="font-display font-semibold text-ink">{tl(grandPaid)}</span>
              </div>
              <div className={`rounded-card px-4 py-2 border ${grandRemaining > 0 ? "bg-amber-light border-amber/30" : "bg-canvas border-line"}`}>
                <span className="text-xs text-ink/50 mr-2">Kalan:</span>
                <span className="font-display font-semibold text-ink">{tl(grandRemaining)}</span>
              </div>
            </div>
          </div>

          <div className="bg-panel border border-line rounded-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-ink/50 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Ad Soyad</th>
                  <th className="text-left px-4 py-3 font-medium">Gün</th>
                  <th className="text-left px-4 py-3 font-medium">Hak Edilen</th>
                  <th className="text-left px-4 py-3 font-medium">Ödenen</th>
                  <th className="text-left px-4 py-3 font-medium">Kalan</th>
                  <th className="text-left px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/40">Hesaplanıyor…</td></tr>
                ) : payroll.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/40">Kayıt yok.</td></tr>
                ) : (
                  payroll.map((p) => (
                    <>
                      <tr key={p.employee_id} className="border-t border-line">
                        <td className="px-4 py-3 font-medium text-ink">{p.full_name}</td>
                        <td className="px-4 py-3">{p.days_worked}</td>
                        <td className="px-4 py-3 font-medium text-ink">{tl(p.total_pay)}</td>
                        <td className="px-4 py-3">{tl(p.total_paid)}</td>
                        <td className={`px-4 py-3 font-medium ${p.remaining > 0 ? "text-amber" : p.remaining < 0 ? "text-danger" : "text-brand"}`}>
                          {tl(p.remaining)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-3">
                          <button onClick={() => openPaymentForm(p.employee_id)} className="text-brand text-xs font-medium underline">
                            + Ödeme
                          </button>
                          <button
                            onClick={() => setExpanded(expanded === p.employee_id ? null : p.employee_id)}
                            className="text-ink/50 text-xs font-medium underline"
                          >
                            {expanded === p.employee_id ? "Gizle" : "Detay"}
                          </button>
                        </td>
                      </tr>

                      {paymentFormFor === p.employee_id && (
                        <tr className="border-t border-line bg-brand-light/40">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="flex flex-wrap items-end gap-3">
                              <div>
                                <label className="block text-xs font-medium text-ink/60 mb-1">Tutar (TL)</label>
                                <input type="number" min="0" step="0.01" value={paymentAmount}
                                  onChange={(e) => setPaymentAmount(e.target.value)}
                                  className="w-28 rounded-lg border border-line px-2 py-1.5 text-sm" placeholder="5000" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-ink/60 mb-1">Tarih</label>
                                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                                  className="rounded-lg border border-line px-2 py-1.5 text-sm" />
                              </div>
                              <div className="flex-1 min-w-[160px]">
                                <label className="block text-xs font-medium text-ink/60 mb-1">Not (opsiyonel)</label>
                                <input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)}
                                  className="w-full rounded-lg border border-line px-2 py-1.5 text-sm" placeholder="Ör. Elden ödendi" />
                              </div>
                              <button onClick={() => submitPayment(p.employee_id)} disabled={paymentSaving}
                                className="rounded-full bg-brand text-white text-sm font-medium px-4 py-2 disabled:opacity-50">
                                {paymentSaving ? "Kaydediliyor…" : "Kaydet"}
                              </button>
                              <button onClick={() => setPaymentFormFor(null)} className="text-ink/40 text-sm underline">
                                Vazgeç
                              </button>
                            </div>
                            {paymentMsg && <p className="text-danger text-xs mt-2">{paymentMsg}</p>}
                          </td>
                        </tr>
                      )}

                      {expanded === p.employee_id && (
                        <tr key={p.employee_id + "-detail"} className="border-t border-line bg-canvas">
                          <td colSpan={6} className="px-4 py-3">
                            <p className="text-xs font-medium text-ink/50 uppercase mb-2">Günlük Döküm</p>
                            <table className="w-full text-xs mb-4">
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
                                      {d.is_leave && <span className="text-blue-600 font-medium"> (izin)</span>}
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

                            <p className="text-xs font-medium text-ink/50 uppercase mb-2">Ödeme Geçmişi</p>
                            {p.payments.length === 0 ? (
                              <p className="text-xs text-ink/40">Bu aralıkta ödeme kaydı yok.</p>
                            ) : (
                              <table className="w-full text-xs">
                                <tbody>
                                  {p.payments.map((pay) => (
                                    <tr key={pay.id} className="border-t border-line/60">
                                      <td className="py-1.5">{fmtDate(pay.payment_date)}</td>
                                      <td className="py-1.5 font-medium">{tl(pay.amount)}</td>
                                      <td className="py-1.5 text-ink/60">{pay.note || "—"}</td>
                                      <td className="py-1.5 text-right">
                                        <button onClick={() => removePayment(pay.id)} className="text-danger underline">Sil</button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
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
