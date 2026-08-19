import { supabaseAdmin } from "../../lib/supabaseAdmin";

// Bu endpoint kasıtlı olarak herkese açıktır (giriş yapmadan erişilir),
// çünkü saha/montaj notu ekranında ve Kasa Defteri'nin "aktif ustalar"
// listesinde kullanılır. Sadece id ve ad-soyad döner; ücret, QR kodu gibi
// hassas bilgi vermez.
export default async function handler(req, res) {
  // CORS: Kasa Defteri gibi farklı bir siteden çağrılabildiği için gerekli.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name");
    if (error) throw error;
    return res.status(200).json({ employees: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
