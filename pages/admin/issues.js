import { useEffect, useState } from "react";
import Head from "next/head";
import AdminLayout, { authedFetch } from "../../components/AdminLayout";

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

export default function IssuesPage() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await authedFetch("/api/issues");
    const data = await res.json();
    setIssues(data.issues || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleResolved = async (issue) => {
    await authedFetch("/api/issues", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: issue.id, resolved: !issue.resolved }),
    });
    load();
  };

  const remove = async (id) => {
    if (!confirm("Bu bildirim silinsin mi?")) return;
    await authedFetch("/api/issues", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

  const filtered = issues.filter((i) => showResolved || !i.resolved);
  const openCount = issues.filter((i) => !i.resolved).length;

  return (
    <AdminLayout>
      <Head><title>Sorunlar - PDKS</title></Head>

      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl font-semibold text-ink">Bildirilen Sorunlar</h1>
        <label className="flex items-center gap-2 text-sm text-ink/60">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Çözülenleri de göster
        </label>
      </div>
      <p className="text-sm text-ink/50 mb-6">
        Çalışanlar çıkış yaptıklarında süre yanlış görünüyorsa buraya bildirebiliyor.
        {openCount > 0 && <span className="text-danger font-medium"> {openCount} açık bildirim var.</span>}
      </p>

      <div className="bg-panel border border-line rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-ink/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Personel</th>
              <th className="text-left px-4 py-3 font-medium">Tarih</th>
              <th className="text-left px-4 py-3 font-medium">Not</th>
              <th className="text-left px-4 py-3 font-medium">Durum</th>
              <th className="text-right px-4 py-3 font-medium">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink/40">Yükleniyor…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink/40">Bildirim yok.</td></tr>
            ) : (
              filtered.map((i) => (
                <tr key={i.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-ink">{i.full_name}</td>
                  <td className="px-4 py-3">{fmtDate(i.work_date)}</td>
                  <td className="px-4 py-3 text-ink/60">{i.note || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${i.resolved ? "bg-brand-light text-brand-dark" : "bg-amber-light text-amber"}`}>
                      {i.resolved ? "Çözüldü" : "Açık"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                    <button onClick={() => toggleResolved(i)} className="text-brand text-xs font-medium underline">
                      {i.resolved ? "Tekrar aç" : "Çözüldü işaretle"}
                    </button>
                    <button onClick={() => remove(i.id)} className="text-danger text-xs font-medium underline">
                      Sil
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink/40 mt-4">
        Bir bildirimi düzeltmek için Panel sayfasındaki "Manuel kayıt" özelliğini kullanıp
        ardından buradan "Çözüldü" işaretleyebilirsin.
      </p>
    </AdminLayout>
  );
}
