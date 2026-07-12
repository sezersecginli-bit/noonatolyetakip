import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { requireAdmin } from "../../lib/requireAdmin";

export default async function handler(req, res) {
  const user = await requireAdmin(req);
  if (!user) return res.status(401).json({ error: "Yetkisiz erişim." });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { start, end, employee_id } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: "start ve end (YYYY-MM-DD) zorunludur." });
    }

    let query = supabaseAdmin
      .from("attendance_logs")
      .select("*, employees(full_name, department)")
      .gte("work_date", start)
      .lte("work_date", end)
      .order("work_date", { ascending: true })
      .order("logged_at", { ascending: true });

    if (employee_id) query = query.eq("employee_id", employee_id);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data.map((r) => ({
      full_name: r.employees?.full_name || "—",
      department: r.employees?.department || "",
      work_date: r.work_date,
      log_type: r.log_type === "in" ? "Giriş" : "Çıkış",
      logged_at: r.logged_at,
      is_late: r.is_late,
      is_early_leave: r.is_early_leave,
      work_duration_min: r.work_duration_min,
      location: r.location === "saha" ? "Şantiye" : "Atölye",
      site_label: r.site_label || "",
    }));

    // Çalışan bazında toplam süre özeti
    const byEmployee = {};
    for (const r of data) {
      const key = r.employees?.full_name || "—";
      if (!byEmployee[key]) {
        byEmployee[key] = { full_name: key, total_minutes: 0, late_count: 0, early_leave_count: 0, days: new Set() };
      }
      byEmployee[key].days.add(r.work_date);
      if (r.log_type === "out" && r.work_duration_min) byEmployee[key].total_minutes += r.work_duration_min;
      if (r.is_late) byEmployee[key].late_count += 1;
      if (r.is_early_leave) byEmployee[key].early_leave_count += 1;
    }
    const summary = Object.values(byEmployee).map((e) => ({
      full_name: e.full_name,
      total_hours: Math.round((e.total_minutes / 60) * 10) / 10,
      late_count: e.late_count,
      early_leave_count: e.early_leave_count,
      days_present: e.days.size,
    }));

    return res.status(200).json({ rows, summary });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
