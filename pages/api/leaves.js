import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { requireAdmin } from "../../lib/requireAdmin";

export default async function handler(req, res) {
  const user = await requireAdmin(req);
  if (!user) return res.status(401).json({ error: "Yetkisiz erişim." });

  try {
    if (req.method === "GET") {
      const { start, end } = req.query;
      let query = supabaseAdmin
        .from("leave_days")
        .select("*, employees(full_name)")
        .order("work_date", { ascending: false });
      if (start) query = query.gte("work_date", start);
      if (end) query = query.lte("work_date", end);

      const { data, error } = await query;
      if (error) throw error;

      const leaves = data.map((l) => ({
        id: l.id,
        employee_id: l.employee_id,
        full_name: l.employees?.full_name || "Tüm personel (resmi tatil)",
        work_date: l.work_date,
        leave_type: l.leave_type,
        paid: l.paid,
        note: l.note,
      }));
      return res.status(200).json({ leaves });
    }

    if (req.method === "POST") {
      const { employee_id, start_date, days, leave_type, paid, note } = req.body;
      if (!start_date) return res.status(400).json({ error: "Tarih zorunludur." });

      const dayCount = Math.max(1, Math.min(60, Number(days) || 1));
      const rows = [];
      const d = new Date(start_date + "T12:00:00Z");
      for (let i = 0; i < dayCount; i++) {
        const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(d);
        rows.push({
          employee_id: employee_id || null,
          work_date: dateStr,
          leave_type: leave_type || "yillik_izin",
          paid: paid !== undefined ? !!paid : true,
          note: note?.trim() || null,
        });
        d.setUTCDate(d.getUTCDate() + 1);
      }

      const { data, error } = await supabaseAdmin.from("leave_days").insert(rows).select();
      if (error) throw error;
      return res.status(200).json({ leaves: data });
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id zorunludur." });
      const { error } = await supabaseAdmin.from("leave_days").delete().eq("id", id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
