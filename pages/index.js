import { useState, useCallback, useRef, useEffect } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import { getCurrentPosition } from "../lib/geo";

const QRScanner = dynamic(() => import("../components/QRScanner"), { ssr: false });

export default function ScanPage() {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldMode, setFieldMode] = useState(false);
  const [fieldNote, setFieldNote] = useState("");
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const busyRef = useRef(false);

  useEffect(() => {
    if (fieldMode && employees.length === 0) {
      fetch("/api/employees-public")
        .then((r) => r.json())
        .then((d) => setEmployees(d.employees || []))
        .catch(() => {});
    }
  }, [fieldMode, employees.length]);

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

  const submitFieldNote = async () => {
    if (!selectedEmployee) {
      setErrorMsg("Lütfen isminizi seçin.");
      setStatus("error");
      return;
    }
    if (!fieldNote.trim()) {
      setErrorMsg("Lütfen nerede olduğunuzu yazın.");
      setStatus("error");
      return;
    }
    setStatus("working");
    setErrorMsg("");
    try {
      const res = await fetch("/api/fieldnote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: selectedEmployee, note: fieldNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "İşlem başarısız.");
        setStatus("error");
      } else {
        setResult({ field: true, ...data });
        setStatus("result");
      }
    } catch (err) {
      setErrorMsg("Bağlantı hatası: " + err.message);
      setStatus("error");
    }
  };

  const reset = () => {
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
    setFieldNote("");
    setSelectedEmployee("");
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
              {fieldMode ? "Saha / montaj notu" : "QR kodunu okutun"}
            </h1>
            <p className="text-sm text-ink/60 mt-1">
              {fieldMode
                ? "İşyerine uğramadan direkt sahaya gidenler için."
                : "Giriş ve çıkış otomatik olarak algılanır."}
            </p>
          </header>
{(status === "idle" || status === "working") && (
            <>
              <label className="flex items-start gap-2.5 mb-4 bg-panel border border-line rounded-card p-3.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fieldMode}
                  onChange={(e) => setFieldMode(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-sm text-ink">
                  <span className="font-medium">Bugün doğrudan sahaya/montaja gidiyorum</span>
                  <br />
                  <span className="text-ink/50 text-xs">
                    İşyerindeki QR kartına uğramanıza gerek yok, isminizi seçip not düşün.
                  </span>
                </span>
              </label>

              {fieldMode ? (
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
                      Nerede olduğunuzu yazın
                    </label>
                    <input
                      value={fieldNote}
                      onChange={(e) => setFieldNote(e.target.value)}
                      placeholder="Ör. Gümüştepe'de montajdaydım"
                      className="w-full rounded-lg border border-line px-3 py-2.5 text-sm"
                    />
                  </div>
                  <button
                    onClick={submitFieldNote}
                    disabled={status === "working"}
                    className="w-full rounded-full bg-brand text-white font-medium py-3 active:scale-[0.98] transition disabled:opacity-50"
                  >
                    {status === "working" ? "Kaydediliyor…" : "Notu kaydet"}
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

          {status === "result" && result && result.field && (
            <div className="bg-panel border border-line rounded-card p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-light">
                <span className="text-2xl">📍</span>
              </div>
              <h2 className="font-display text-xl font-semibold text-ink mb-1">
                {result.employee_name}
              </h2>
              <p className="text-sm font-medium mb-3">Saha notu kaydedildi</p>
              <p className="text-ink/70 text-sm mb-1">
                {new Date(result.work_date).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}
              </p>
              <p className="text-ink text-sm bg-canvas rounded-lg px-3 py-2 mb-1">
                "{result.note}"
              </p>
              <button
                onClick={reset}
                className="mt-5 w-full rounded-full bg-brand text-white font-medium py-3 active:scale-[0.98] transition"
              >
                Tamam
              </button>
            </div>
          )}

          {status === "result" && result && !result.field && (
            <div className="bg-panel border border-line rounded-card p-6 text-center">
              <div
                className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
                  result.log_type === "in" ? "bg-brand-light" : "bg-amber-light"
                }`}
              >
                <span className="text-2xl">{result.log_type === "in" ? "→" : "←"}</span>
              </div>
              <h2 className="font-display text-xl font-semibold text-ink mb-1">
                {result.employee_name}
              </h2>
              <p className="text-sm font-medium mb-3">
                {result.log_type === "in" ? "Giriş kaydedildi" : "Çıkış kaydedildi"}
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
              {result.work_duration_min != null && (
                <p className="text-ink/60 text-sm">
                  Bugünkü çalışma süresi: {Math.floor(result.work_duration_min / 60)} sa{" "}
                  {result.work_duration_min % 60} dk
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
