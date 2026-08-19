import { supabaseAdmin } from "../../lib/supabaseAdmin";

// Bu endpoint, PDKS dışındaki güvenilir bir uygulamanın (örn. Atölye Kasa
// Defteri) personel ödemesi kayıtlarını buraya otomatik işleyebilmesi için
// var. Normal admin girişi gerektirmez, bunun yerine EXTERNAL_SYNC_SECRET
// ortam değişkeniyle korunur — sadece bu anahtarı bilen istemciler
// kullanabilir.
export default async function handler(req, res) {
  // CORS: bu endpoint farklı bir siteden (örn. Netlify'daki Kasa Defteri)
  // çağrıldığı için tarayıcıya açık izin vermemiz gerekiyor.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization || "";
  if (!process.env.EXTERNAL_SYNC_SECRET || authHeader !== `Bearer ${process.env.EXTERNAL_SYNC_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { employee_name, employee_id, amount, payment_date, note, source } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Geçerli bir tutar zorunludur." });
    }
    if (!employee_name && !employee_id) {
      return res.status(400).json({ error: "employee_name veya employee_id zorunludur." });
    }

    let employee;
    if (employee_id) {
      const { data, error } = await supabaseAdmin
        .from("employees")
        .select("id, full_name")
        .eq("id", employee_id)
        .maybeSingle();
      if (error) throw error;
      employee = data;
    } else {
      // İsimle eşleştirme: büyük/küçük harf duyarsız, kısmi eşleşme.
      // "Ahmet" hem "Ahmet" hem "Ahmet Yılmaz" ile eşleşebilir.
      const cleanName = employee_name.trim();
      const { data, error } = await supabaseAdmin
        .from("employees")
        .select("id, full_name")
        .eq("is_active", true)
        .ilike("full_name", `%${cleanName}%`);
      if (error) throw error;
      if (data.length === 1) {
        employee = data[0];
      } else if (data.length > 1) {
        return res.status(409).json({
          error: `"${employee_name}" adıyla birden fazla personel eşleşti (${data.map((d) => d.full_name).join(", ")}). employee_id ile belirtin.`,
        });
      }
    }

    if (!employee) {
      return res.status(404).json({ error: `Personel bulunamadı: ${employee_name || employee_id}` });
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("payments")
      .insert({
        employee_id: employee.id,
        amount: Number(amount),
        payment_date: payment_date || new Date().toISOString().slice(0, 10),
        note: note?.trim() || (source ? `Kaynak: ${source}` : null),
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    return res.status(200).json({ success: true, payment: inserted, employee_name: employee.full_name });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
