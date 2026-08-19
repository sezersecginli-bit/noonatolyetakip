import { useState, useCallback, useRef, useEffect } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import { getCurrentPosition } from "../lib/geo";

const QRScanner = dynamic(() => import("../components/QRScanner"), { ssr: false });

function greetingFor(iso) {
  const hourStr = new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    hour12: false,
  });
  const h = parseInt(hourStr, 10);
  if (h >= 5 && h < 12) return "Günaydın";
  if (h >= 12 && h < 18) return "İyi günler";
  return "İyi akşamlar";
}

function workDateFromIso(iso) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date(iso));
}

function todayIstanbulStr() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

function firstOfMonthIstanbulStr() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  return `${y}-${m}-01`;
}

export default function ScanPage() {
  const [mode, setMode] = useState("checkin");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [siteLabel, setSiteLabel] = useState("");
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [summaryStart, setSummaryStart] = useState(firstOfMonthIstanbulStr());
  const [summaryEnd, setSummaryEnd] = useState(todayIstanbulStr());
  const busyRef = useRef(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportNote, setReportNote] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [reportSaving, setReportSaving] = useState(false);

  useEffect(() => {
    if ((mode === "field" || mode === "summary") && employees.length === 0) {
      fetch("/api/employees-public")
        .then((r) => r.json())
        .then((d) => setEmployees(d.employees || []))
        .catch(() => {});
    }
  }, [mode, employees.length]);

  const handleScan = useCallback(async (qrText) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStatus("working");
    setErrorMsg("");

    try {
      let lat = null,
        lng = null;
      try {
        const pos = await getCurrentPosition({ timeout: 6000 });
        lat = pos.lat;
        lng = pos.lng;
      } catch {
      }

      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_token: qrText, lat, lng }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "İşlem başarısız.");
        setStatus("error");
      } else {
        setResult(data);
        setStatus("result");
      }
    } catch (err) {
      setErrorMsg("Bağlantı hatası: " + err.message);
      setStatus("error");
    } finally {
      setTimeout(() => {
        busyRef.current = false;
      }, 2500);
    }
  }, []);

  const [summaryPin, setSummaryPin] = useState("");
  const [summaryUpdating, setSummaryUpdating] = useState(false);

  const submitSummary = async () => {
    if (!selectedEmployee) {
      setErrorMsg("Lütfen isminizi seçin.");
      setStatus("error");
      return;
    }
    if (!summaryPin.trim()) {
      setErrorMsg("Lütfen PIN kodunuzu girin.");
      setStatus("error");
      return;
    }
    const alreadyShowingResult = status === "summary-result";
    if (alreadyShowingResult) {
      setSummaryUpdating(true);
    } else {
      setStatus("working");
    }
    setErrorMsg("");
    try {
      const res = await fetch("/api/mysummary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: selectedEmployee,
          pin_code: summaryPin.trim(),
          start: summaryStart,
          end: summaryEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "İşlem başarısız.");
        setStatus("error");
      } else {
        setSummary(data);
        setStatus("summary-result");
      }
    } catch (err) {
      setErrorMsg("Bağlantı hatası: " + err.message);
      setStatus("error");
    } finally {
      setSummaryUpdating(false);
    }
  };

  const submitSiteCheck = async (forcedType) => {
    if (!selectedEmployee) {
      setErrorMsg("Lütfen isminizi seçin.");
      setStatus("error");
      return;
    }
    setStatus("working");
    setErrorMsg("");
    try {
      const res = await fetch("/api/sitecheckin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: selectedEmployee, site_label: siteLabel.trim(), forced_type: forcedType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "İşlem başarısız.");
        setStatus("error");
      } else {
        setResult({ site: true, ...data });
        setStatus("result");
      }
    } catch (err) {
      setErrorMsg("Bağlantı hatası: " + err.message);
      setStatus("error");
    }
  };

  const submitReport = async () => {
    if (!result?.employee_id) return;
    setReportSaving(true);
    try {
      await fetch("/api/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: result.employee_id,
          work_date: workDateFromIso(result.logged_at),
          note: reportNote.trim(),
        }),
      });
      setReportSent(true);
    } catch {
      setReportSent(true);
    } finally {
      setReportSaving(false);
    }
  };

  const reset = () => {
    setStatus("idle");
    setResult(null);
    setSummary(null);
    setErrorMsg("");
    setSiteLabel("");
    setSelectedEmployee("");
    setReportOpen(false);
    setReportNote("");
    setReportSent(false);
    setSummaryPin("");
  };

  const switchMode = (newMode) => {
    reset();
    setMode(newMode);
  };

  return (
    <>
      <Head>
        <title>Personel Giriş / Çıkış</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <main className="min-h-screen bg-canvas flex flex-col items-center px-5 py-8">
        <div className="w-full max-w-sm">
          <header className="mb-6 text-center">
            <p className="font-mono text-xs tracking-wider text-brand uppercase mb-1">PDKS</p>
            <h1 className="font-display text-2xl font-semibold text-ink">
              {mode === "field" ? "Şantiye giriş / çıkış" : mode === "summary" ? "Aylık özetim" : "QR kodunu okutun"}
            </h1>
            <p className="text-sm text-ink/60 mt-1">
              {mode === "field"
                ? "Şantiyeye vardığınızda Giriş, ayrılırken Çıkış yapın."
                : mode === "summary"
                ? "İsminizi seçip PIN kodunuzla özetinizi görün."
                : "Giriş ve çıkış otomatik olarak algılanır."}
            </p>
          </header>

          {(status === "idle" || status === "working") && (
            <>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => switchMode("checkin")}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition ${mode === "checkin" ? "bg-ink text-white" : "bg-panel border border-line text-ink/60"}`}
                >
                  Giriş / Çıkış
                </button>
                <button
                  onClick={() => switchMode("field")}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition ${mode === "field" ? "bg-ink text-white" : "bg-panel border border-line text-ink/60"}`}
                >
                  Şantiyedeyim
                </button>
                <button
                  onClick={() => switchMode("summary")}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition ${mode === "summary" ? "bg-ink text-white" : "bg-panel border border-line text-ink/60"}`}
                >
                  Aylık Özetim
                </button>
              </div>

              {mode === "field" ? (
                <div className="bg-panel border border-line rounded-card p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-ink/60 mb-1">İsminiz</label>
                    <select
                      value={selectedEmployee}
                      onChange={(e) => setSelectedEmployee(e.target.value)}
                      className="w-full rounded-lg border border-line px-3 py-2.5 text-sm bg-panel"
                    >
                      <option value="">Seçiniz…</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink/60 mb-1">
                      Şantiye adı (opsiyonel)
                    </label>
                    <input
                      value={siteLabel}
                      onChange={(e) => setSiteLabel(e.target.value)}
                      placeholder="Ör. Gümüştepe"
                      className="w-full rounded-lg border border-line px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => submitSiteCheck("in")}
                      disabled={status === "working"}
                      className="flex-1 rounded-full bg-brand text-white font-medium py-3 active:scale-[0.98] transition disabled:opacity-50"
                    >
                      {status === "working" ? "…" : "Giriş yap"}
                    </button>
                    <button
                      onClick={() => submitSiteCheck("out")}
                      disabled={status === "working"}
                      className="flex-1 rounded-full bg-amber text-white font-medium py-3 active:scale-[0.98] transition disabled:opacity-50"
                    >
                      {status === "working" ? "…" : "Çıkış yap"}
                    </button>
                  </div>
                </div>
              ) : mode === "summary" ? (
                <div className="bg-panel border border-line rounded-card p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-ink/60 mb-1">İsminiz</label>
                    <select
                      value={selectedEmployee}
                      onChange={(e) => setSelectedEmployee(e.target.value)}
                      className="w-full rounded-lg border border-line px-3 py-2.5 text-sm bg-panel"
                    >
                      <option value="">Seçiniz…</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink/60 mb-1">PIN kodunuz</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      value={summaryPin}
                      onChange={(e) => setSummaryPin(e.target.value)}
                      placeholder="••••"
                      className="w-full rounded-lg border border-line px-3 py-2.5 text-sm"
                    />
                  </div>
                  <button
                    onClick={submitSummary}
                    disabled={status === "working"}
                    className="w-full rounded-full bg-brand text-white font-medium py-3 active:scale-[0.98] transition disabled:opacity-50"
                  >
                    {status === "working" ? "Hazırlanıyor…" : "Özetimi göster"}
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <QRScanner onScan={handleScan} onError={(m) => { setErrorMsg(m); setStatus("error"); }} paused={status === "working"} />
                  {status === "working" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-card">
                      <span className="text-white font-medium text-sm">Kaydediliyor…</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {status === "summary-result" && summary && (
            <div className="bg-panel border border-line rounded-card p-6">
              <div className="text-center mb-5">
                <p className="font-mono text-xs tracking-wider text-brand uppercase mb-1">{summary.month_label}</p>
                <h2 className="font-display text-xl font-semibold text-ink">{summary.employee_name}</h2>
              </div>

              <div className="flex gap-2 mb-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-ink/60 mb-1">Başlangıç</label>
                  <input
                    type="date"
                    value={summaryStart}
                    onChange={(e) => setSummaryStart(e.target.value)}
                    className="w-full rounded-lg border border-line px-2 py-1.5 text-xs"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-ink/60 mb-1">Bitiş</label>
                  <input
                    type="date"
                    value={summaryEnd}
                    onChange={(e) => setSummaryEnd(e.target.value)}
                    className="w-full rounded-lg border border-line px-2 py-1.5 text-xs"
                  />
                </div>
                <button
                  onClick={submitSummary}
                  disabled={summaryUpdating}
                  className="self-end rounded-lg bg-ink text-white text-xs font-medium px-3 py-1.5 disabled:opacity-50 whitespace-nowrap"
                >
                  {summaryUpdating ? "…" : "Güncelle"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="bg-canvas rounded-lg p-3 text-center">
                  <p className="font-display text-2xl font-semibold text-ink">{summary.days_worked}</p>
                  <p className="text-xs text-ink/50">Çalışılan gün</p>
                </div>
                <div className="bg-canvas rounded-lg p-3 text-center">
                  <p className="font-display text-2xl font-semibold text-ink">{summary.total_hours}</p>
                  <p className="text-xs text-ink/50">Toplam saat</p>
                </div>
                <div className="bg-canvas rounded-lg p-3 text-center">
                  <p className="font-display text-2xl font-semibold text-ink">{summary.late_count}</p>
                  <p className="text-xs text-ink/50">Geç kalma</p>
                </div>
                <div className="bg-canvas rounded-lg p-3 text-center">
                  <p className="font-display text-2xl font-semibold text-ink">{summary.early_leave_count}</p>
                  <p className="text-xs text-ink/50">Erken çıkış</p>
                </div>
              </div>
              {summary.leave_days_count > 0 && (
                <p className="text-center text-sm text-ink/60 mt-2 mb-3">
                  Bu ay {summary.leave_days_count} gün izinlisiniz.
                </p>
              )}

              {summary.days && summary.days.length > 0 && (
                <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-line divide-y divide-line">
                  {summary.days.map((d) => (
                    <div key={d.work_date} className="px-3 py-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-ink">
                          {(() => {
                            const [y, m, dd] = d.work_date.split("-");
                            return `${dd}.${m}.${y}`;
                          })()}
                          {d.location === "saha" && (
                            <span className="ml-1.5 text-xs text-amber font-normal">Şantiye</span>
                          )}
                        </span>
                        <span className="text-ink/60 font-mono text-xs">
                          {d.check_in
                            ? new Date(d.check_in).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" })
                            : "—"}
                          {" – "}
                          {d.check_out
                            ? new Date(d.check_out).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" })
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {d.work_duration_min != null && (
                          <span className="text-xs text-ink/40">
                            {Math.floor(d.work_duration_min / 60)}sa {d.work_duration_min % 60}dk
                          </span>
                        )}
                        {d.is_late && <span className="text-xs text-danger font-medium">Geç</span>}
                        {d.is_early_leave && <span className="text-xs text-danger font-medium">Erken çıkış</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={reset}
                className="mt-5 w-full rounded-full bg-brand text-white font-medium py-3 active:scale-[0.98] transition"
              >
                Tamam
              </button>
            </div>
          )}

          {status === "result" && result && (
            <div className="bg-panel border border-line rounded-card p-6 text-center">
              <div
                className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
                  result.log_type === "in" ? "bg-brand-light" : "bg-amber-light"
                }`}
              >
                <span className="text-2xl">
                  {result.site ? "📍" : result.log_type === "in" ? "→" : "←"}
                </span>
              </div>
              <h2 className="font-display text-xl font-semibold text-ink mb-1">
                {greetingFor(result.logged_at)}, {result.employee_name}!
              </h2>
              <p className="text-sm font-medium mb-3">
                {result.site
                  ? result.log_type === "in"
                    ? `Şantiyeye giriş kaydedildi${result.site_label ? " — " + result.site_label : ""}`
                    : `Şantiyeden çıkış kaydedildi${result.site_label ? " — " + result.site_label : ""}, ${greetingFor(result.logged_at).toLowerCase()}!`
                  : result.log_type === "in"
                  ? "Giriş kaydedildi, iyi çalışmalar!"
                  : `Çıkış kaydedildi, ${greetingFor(result.logged_at).toLowerCase()}!`}
              </p>
              <p className="text-3xl font-mono font-semibold text-ink mb-3">
                {new Date(result.logged_at).toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Istanbul",
                })}
              </p>

              {result.is_late && (
                <p className="text-danger text-sm font-medium mb-1">⚠ Geç kalındı</p>
              )}
              {result.is_early_leave && (
                <p className="text-danger text-sm font-medium mb-1">⚠ Erken çıkış</p>
              )}

              {result.log_type === "out" && result.work_duration_min != null && (
                <div className="bg-canvas rounded-lg px-4 py-3 mb-1">
                  <p className="text-ink font-medium">
                    Bugün{" "}
                    <span className="font-display text-lg">
                      {Math.floor(result.work_duration_min / 60)} saat {result.work_duration_min % 60} dakika
                    </span>{" "}
                    çalıştınız.
                  </p>
                </div>
              )}

              {result.log_type === "out" && !reportSent && (
                <div className="mt-2">
                  {!reportOpen ? (
                    <button
                      onClick={() => setReportOpen(true)}
                      className="text-xs text-ink/40 underline"
                    >
                      Bu süre yanlış görünüyor, bildir
                    </button>
                  ) : (
                    <div className="text-left mt-3">
                      <label className="block text-xs font-medium text-ink/60 mb-1">
                        Ne yanlış? (opsiyonel)
                      </label>
                      <input
                        value={reportNote}
                        onChange={(e) => setReportNote(e.target.value)}
                        placeholder="Ör. Sabah giriş saatim yanlış görünüyor"
                        className="w-full rounded-lg border border-line px-3 py-2 text-sm mb-2"
                      />
                      <button
                        onClick={submitReport}
                        disabled={reportSaving}
                        className="w-full rounded-full bg-ink text-white text-sm font-medium py-2.5 disabled:opacity-50"
                      >
                        {reportSaving ? "Gönderiliyor…" : "Yöneticiye bildir"}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {reportSent && (
                <p className="text-brand text-sm font-medium mt-2">
                  Bildirdiniz, yönetici inceleyecek.
                </p>
              )}

              <button
                onClick={reset}
                className="mt-5 w-full rounded-full bg-brand text-white font-medium py-3 active:scale-[0.98] transition"
              >
                Tamam
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="bg-panel border border-danger/30 rounded-card p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
                <span className="text-2xl text-danger">✕</span>
              </div>
              <p className="text-ink font-medium mb-4">{errorMsg}</p>
              <button
                onClick={reset}
                className="w-full rounded-full bg-ink text-white font-medium py-3 active:scale-[0.98] transition"
              >
                Tekrar dene
              </button>
            </div>
          )}
        </div>

        <a href="/admin" className="mt-10 text-xs text-ink/40 underline">
          Yönetici girişi
        </a>
      </main>
    </>
  );
}
