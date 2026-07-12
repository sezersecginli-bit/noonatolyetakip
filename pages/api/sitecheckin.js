import { supabaseAdmin } from "../../lib/supabaseAdmin";

function todayIstanbul() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
  return fmt.format(new Date());
}

function nowIstanbulMinutes() {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = fmt.format(new Date()).split(":").map(Number);
  return h * 60 + m;
}

function timeStrToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { employee_id, site_label } = req.body;
    if (!employee_id) {
      return res.status(400).json({ error: "Personel belirtilmedi." });
    }

    const { data: employee, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("id", employee_id)
      .eq("is_active", true)
      .maybeSingle();
    if (empErr) throw empErr;
    if (!employee) return res.status(404).json({ error: "Aktif personel bulunamadı." });

    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from("work_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (settingsErr) throw settingsErr;

    const work_date = todayIstanbul();

    const { data: lastLog, error: lastErr } = await supabaseAdmin
      .from("attendance_logs")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("work_date", work_date)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastErr) throw lastErr;

    const log_type = !lastLog || lastLog.log_type === "out" ? "in" : "out";

    const nowMinutes = nowIstanbulMinutes();
    let is_late = false;
    let is_early_leave = false;
    let work_duration_min = null;

    if (log_type === "in") {
      const startMin = timeStrToMinutes(settings.work_start);
      is_late = nowMinutes > startMin + settings.late_tolerance_minutes;
    } else {
      const endMin = timeStrToMinutes(settings.work_end);
      is_early_leave = nowMinutes < endMin - settings.early_leave_tolerance_min;
      if (lastLog && lastLog.log_type === "in") {
        const diffMs = new Date() - new Date(lastLog.logged_at);
        work_duration_min = Math.max(0, Math.round(diffMs / 60000));
      }
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("attendance_logs")
      .insert({
        employee_id: employee.id,
        log_type,
        work_date,
        is_late,
        is_early_leave,
        work_duration_min,
        location: "saha",
        site_label: site_label?.trim() || null,
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    return res.status(200).json({
      success: true,
      employee_name: employee.full_name,
      log_type,
      logged_at: inserted.logged_at,
      is_late,
      is_early_leave,
      work_duration_min,
      site_label: inserted.site_label,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
