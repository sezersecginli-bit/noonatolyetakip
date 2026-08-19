import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { requireAdmin } from "../../lib/requireAdmin";

function timeStrToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Bir günün tüm kayıtlarını zaman sırasına göre yeniden hesaplar
async function recalcDay(employee_id, work_date, settings) {
  const { data: logs, error } = await supabaseAdmin
    .from("attendance_logs")
    .select("*")
    .eq("employee_id", employee_id)
    .eq("work_date", work_date)
    .order("logged_at", { ascending: true });
  if (error) throw error;

  let prevIn = null;
  for (const log of logs) {
    const timeStr = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(log.logged_at));
    const minutes = timeStrToMinutes(timeStr);

    let update = {};
    if (log.log_type === "in") {
      const startMin = timeStrToMinutes(settings.work_start);
      update.is_late = minutes > startMin + settings.late_tolerance_minutes;
      update.is_early_leave = false;
      update.work_duration_min = null;
      prevIn = log;
    } else {
      const endMin = timeStrToMinutes(settings.work_end);
      update.is_early_leave = minutes < endMin - settings.early_leave_tolerance_min;
      update.is_late = false;
      if (prevIn) {
        const diffMs = new Date(log.logged_at) - new Date(prevIn.logged_at);
        update.work_duration_min = Math.max(0, Math.round(diffMs / 60000));
      } else {
        update.work_duration_min = null;
      }
      prevIn = null;
    }
    await supabaseAdmin.from("attendance_logs").update(update).eq("id", log.id);
  }
}

export default async function handler(req, res) {
  const user = await requireAdmin(req);
  if (!user) return res.status(401).json({ error: "Yetkisiz erişim." });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { employee_id, dates, time_in, time_out, location } = req.body;

    if (!employee_id || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: "Personel ve en az bir tarih zorunludur." });
    }
    if (!time_in && !time_out) {
      return res.status(400).json({ error: "Giriş ya da çıkış saatinden en az biri girilmelidir." });
    }
    if (dates.length > 62) {
      return res.status(400).json({ error: "Tek seferde en fazla 62 gün seçebilirsiniz." });
    }

    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from("work_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (settingsErr) throw settingsErr;

    const loc = location || "atolye";
    let created = 0;

    for (const work_date of dates) {
      const rows = [];
      if (time_in) {
        rows.push({
          employee_id,
          work_date,
          log_type: "in",
          logged_at: `${work_date}T${time_in}:00+03:00`,
          location: loc,
          is_late: false,
          is_early_leave: false,
          work_duration_min: null,
        });
      }
      if (time_out) {
        rows.push({
          employee_id,
          work_date,
          log_type: "out",
          logged_at: `${work_date}T${time_out}:00+03:00`,
          location: loc,
          is_late: false,
          is_early_leave: false,
          work_duration_min: null,
        });
      }
      if (rows.length) {
        const { error: insertErr } = await supabaseAdmin.from("attendance_logs").insert(rows);
        if (insertErr) throw insertErr;
        created += rows.length;
        await recalcDay(employee_id, work_date, settings);
      }
    }

    return res.status(200).json({ success: true, days: dates.length, created });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
