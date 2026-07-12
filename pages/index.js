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

export default function ScanPage() {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldMode, setFieldMode] = useState(false);
  const [siteLabel, setSiteLabel] = useState("");
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

  const reset = () => {
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
    setSiteLabel("");
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
              {fieldMode ? "Şantiye giriş / çıkış" : "QR kodunu okutun"}
            </h1>
            <p className="text-sm text-ink/60 mt-1">
              {fieldMode
                ? "Şantiyeye vardığınızda Giriş, ayrılırken Çıkış yapın."
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
                  <span className="font-medium">Bugün şantiyedeyim</span>
                  <br />
                  <span className="text-ink/50 text-xs">
                    İşyerindeki QR kartına uğramanıza gerek yok, isminizi seçip giriş/çıkış yapın.
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
                      Şantiye adı (opsiyonel)
                    </label>
                    <input
                      value={siteLabel}
                      onChange={(e) => setSiteLabel(e.target.value)}
           
