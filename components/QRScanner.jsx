import { useEffect, useRef } from "react";

export default function QRScanner({ onScan, onError, paused }) {
  const containerId = "qr-reader";
  const scannerRef = useRef(null);
  const isRunningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode(containerId, { verbose: false });
      scannerRef.current = scanner;

      // Kamera etiketine göre seçmek yerine doğrudan arka kamerayı (environment)
      // talep ediyoruz - bu, iPhone/Safari dahil çoğu cihazda daha güvenilir çalışır.
      const startWith = (constraint) =>
        scanner.start(
          constraint,
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (!isRunningRef.current) return;
            onScan(decodedText);
          },
          () => {} // sürekli tarama hatalarını sessiz geç
        );

      startWith({ facingMode: { exact: "environment" } })
        .then(() => {
          isRunningRef.current = true;
        })
        .catch(() => {
          // Bazı cihazlarda "exact" reddedilebilir; daha esnek bir istekle tekrar dene
          startWith({ facingMode: "environment" })
            .then(() => {
              isRunningRef.current = true;
            })
            .catch((err) => onError?.(err?.message || "Kamera başlatılamadı."));
        });
    });

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner && isRunningRef.current) {
        isRunningRef.current = false;
        scanner.stop().then(() => scanner.clear()).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative overflow-hidden rounded-card bg-black">
      <div id={containerId} className={paused ? "opacity-40" : ""} />
      <div className="pointer-events-none absolute inset-0 border-[3px] border-amber/70 rounded-card m-6" />
    </div>
  );
}
