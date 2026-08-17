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

  return logs.length;
}

export default async function handler(req, res) {
  const user = await requireAdmin(req);
  if (!user) return res.status(401).json({ error: "Yetkisiz erişim." });

  try {
    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from("work_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (settingsErr) throw settingsErr;

    if (req.method === "GET") {
      const { employee_id, work_date } = req.query;
      if (!employee_id || !work_date) {
        return res.status(400).json({ error: "employee_id ve work_date zorunludur." });
      }
      const { data, error } = await supabaseAdmin
        .from("attendance_logs")
        .select("*")
        .eq("employee_id", employee_id)
        .eq("work_date", work_date)
        .order("logged_at", { ascending: true });
      if (error) throw error;
      return res.status(200).json({ logs: data });
    }

    if (req.method === "POST") {
      const { employee_id, work_date, log_type, time, location } = req.body;
      if (!employee_id || !work_date || !log_type || !time) {
        return res.status(400).json({ error: "Eksik bilgi." });
      }
      const logged_at = `${work_date}T${time}:00+03:00`;
      const { error: insertErr } = await supabaseAdmin.from("attendance_logs").insert({
        employee_id,
        work_date,
        log_type,
        logged_at,
        location: location || "atolye",
        is_late: false,
        is_early_leave: false,
        work_duration_min: null,
      });
      if (insertErr) throw insertErr;
      await recalcDay(employee_id, work_date, settings);
      return res.status(200).json({ success: true });
    }

    if (req.method === "PATCH") {
      const { id, time, log_type } = req.body;
      if (!id || !time) return res.status(400).json({ error: "Eksik bilgi." });

      const { data: existing, error: exErr } = await supabaseAdmin
        .from("attendance_logs")
        .select("*")
        .eq("id", id)
        .single();
      if (exErr) throw exErr;

      const logged_at = `${existing.work_date}T${time}:00+03:00`;
      const update = { logged_at };
      if (log_type === "in" || log_type === "out") update.log_type = log_type;

      const { error: updErr } = await supabaseAdmin
        .from("attendance_logs")
        .update(update)
        .eq("id", id);
      if (updErr) throw updErr;

      await recalcDay(existing.employee_id, existing.work_date, settings);
      return res.status(200).json({ success: true });
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id zorunludur." });

      const { data: existing, error: exErr } = await supabaseAdmin
        .from("attendance_logs")
        .select("*")
        .eq("id", id)
        .single();
      if (exErr) throw exErr;

      const { error: delErr } = await supabaseAdmin.from("attendance_logs").delete().eq("id", id);
      if (delErr) throw delErr;

      await recalcDay(existing.employee_id, existing.work_date, settings);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
