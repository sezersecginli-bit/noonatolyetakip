import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

const NAV = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/employees", label: "Personel" },
  { href: "/admin/reports", label: "Raporlar" },
  { href: "/admin/payroll", label: "Bordro" },
  { href: "/admin/settings", label: "Ayarlar" },
];

export default function AdminLayout({ children }) {
  const router = useRouter();
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) router.replace("/admin/login");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (!sess) router.replace("/admin/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink/50 text-sm">
        Yükleniyor…
      </div>
    );
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-panel">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-wider text-brand uppercase">PDKS</p>
            <p className="font-display text-sm font-semibold text-ink">Yönetici Paneli</p>
          </div>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  router.pathname === item.href
                    ? "bg-brand text-white"
                    : "text-ink/60 hover:bg-brand-light"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => supabase.auth.signOut()}
              className="ml-2 text-sm text-ink/40 hover:text-danger"
            >
              Çıkış
            </button>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-5 py-8">{children}</main>
    </div>
  );
}

export async function authedFetch(url, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}
