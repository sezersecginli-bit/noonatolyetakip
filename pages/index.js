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
                : "Giriş ve çıkış otomatik olarak
