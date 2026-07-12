import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { requireAdmin } from "../../lib/requireAdmin";

function timeStrToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default async function handler(req, res) {
  const user = await requireAdmin(req);
  if (!user) return res.status(401).json({ error: "Yetkisiz erişim." });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { employee_id, work_date, log_type, time } = req.body;

    if (!employee_id || !work_date || !log_type || !time) {
      return res.status(400).json({ error: "Eksik bilgi: personel, tarih, tip ve saat zorunludur." });
    }
    if (log_type !== "in" && log_type !== "out") {
      return res.status(400).json({ error: "Geçersiz kayıt tipi." });
    }

    const { data: employee, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("id", employee_id)
      .maybeSingle();
    if (empErr) throw empErr;
    if (!employee) return res.status(404).json({ error: "Personel bulunamadı." });

    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from("work_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (settingsErr) throw settingsErr;

    const logged_at = `${work_date}T${time}:00+03:00`;

    const { data: dayLogs, error: dayErr } = await supabaseAdmin
      .from("attendance_logs")
      .select("*")
      .eq("employee_id", employee_id)
      .eq("work_date", work_date)
      .order("logged_at", { ascending: true });
    if (dayErr) throw dayErr;

    const before = dayLogs.filter((l) => new Date(l.logged_at) < new Date(logged_at));
    const prev = before.length ? before[before.length - 1] : null;

    if (prev && prev.log_type === log_type) {
      return res.status(409).json({
        error:
          log_type === "in"
            ? "Bu saatten hemen önce zaten bir giriş kaydı var."
            : "Bu saatten hemen önce zaten bir çıkış kaydı var.",
      });
    }

    const timeMinutes = timeStrToMinutes(time);
    let is_late = false;
    let is_early_leave = false;
    let work_duration_min = null;

    if (log_type === "in") {
      const startMin = timeStrToMinutes(settings.work_start);
      is_late = timeMinutes > startMin + settings.late_tolerance_minutes;
    } else {
      const endMin = timeStrToMinutes(settings.work_end);
      is_early_leave = timeMinutes < endMin - settings.early_leave_tolerance_min;
      if (prev && prev.log_type === "in") {
        const diffMs = new Date(logged_at) - new Date(prev.logged_at);
        work_duration_min = Math.max(0, Math.round(diffMs / 60000));
      }
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("attendance_logs")
      .insert({
        employee_id,
        log_type,
        work_date,
        logged_at,
        is_late,
        is_early_leave,
        work_duration_min,
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    return res.status(200).json({ success: true, log: inserted, employee_name: employee.full_name });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
