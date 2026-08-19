import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { requireAdmin } from "../../lib/requireAdmin";

export default async function handler(req, res) {
  const user = await requireAdmin(req);
  if (!user) return res.status(401).json({ error: "Yetkisiz erişim." });

  try {
    if (req.method === "GET") {
      const { employee_id, start, end } = req.query;
      let query = supabaseAdmin
        .from("payments")
        .select("*, employees(full_name)")
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (employee_id) query = query.eq("employee_id", employee_id);
      if (start) query = query.gte("payment_date", start);
      if (end) query = query.lte("payment_date", end);

      const { data, error } = await query;
      if (error) throw error;

      const payments = data.map((p) => ({
        id: p.id,
        employee_id: p.employee_id,
        full_name: p.employees?.full_name || "—",
        amount: p.amount,
        payment_date: p.payment_date,
        note: p.note,
      }));
      return res.status(200).json({ payments });
    }

    if (req.method === "POST") {
      const { employee_id, amount, payment_date, note } = req.body;
      if (!employee_id || !amount) {
        return res.status(400).json({ error: "Personel ve tutar zorunludur." });
      }
      const { data, error } = await supabaseAdmin
        .from("payments")
        .insert({
          employee_id,
          amount: Number(amount),
          payment_date: payment_date || new Date().toISOString().slice(0, 10),
          note: note?.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ payment: data });
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id zorunludur." });
      const { error } = await supabaseAdmin.from("payments").delete().eq("id", id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
