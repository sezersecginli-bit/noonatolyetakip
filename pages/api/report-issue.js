import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { employee_id, work_date, note } = req.body;
    if (!employee_id || !work_date) {
      return res.status(400).json({ error: "Eksik bilgi." });
    }

    const { data: employee, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("id, full_name")
      .eq("id", employee_id)
      .maybeSingle();
    if (empErr) throw empErr;
    if (!employee) return res.status(404).json({ error: "Personel bulunamadı." });

    const { error: insertErr } = await supabaseAdmin.from("issue_reports").insert({
      employee_id,
      work_date,
      note: note?.trim() || null,
    });
    if (insertErr) throw insertErr;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
