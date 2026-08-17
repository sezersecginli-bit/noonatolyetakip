import { supabaseAdmin } from "../../lib/supabaseAdmin";

function firstOfMonthIstanbul() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  return `${y}-${m}-01`;
}

function todayIstanbul() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

function monthLabelIstanbul() {
  return new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", month: "long", year: "numeric" }).format(new Date());
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { qr_token } = req.body;
    if (!qr_token) return res.status(400).json({ error: "QR kod bulunamadı." });

    const { data: employee, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("id, full_name")
      .eq("qr_token", qr_token)
      .eq("is_active", true)
      .maybeSingle();
    if (empErr) throw empErr;
    if (!employee) return res.status(404).json({ error: "Bu QR koda ait aktif personel bulunamadı." });

    const start = firstOfMonthIstanbul();
    const end = todayIstanbul();

    const { data: logs, error: logErr } = await supabaseAdmin
      .from("attendance_logs")
      .select("work_date, log_type, is_late, is_early_leave, work_duration_min")
      .eq("employee_id", employee.id)
      .gte("work_date", start)
      .lte("work_date", end);
    if (logErr) throw logErr;

    const { data: leaves, error: leaveErr } = await supabaseAdmin
      .from("leave_days")
      .select("work_date")
      .or(`employee_id.eq.${employee.id},employee_id.is.null`)
      .gte("work_date", start)
      .lte("work_date", end);
    if (leaveErr) throw leaveErr;

    const workDates = new Set(logs.map((l) => l.work_date));
    const totalMinutes = logs
      .filter((l) => l.log_type === "out" && l.work_duration_min)
      .reduce((sum, l) => sum + l.work_duration_min, 0);
    const lateCount = logs.filter((l) => l.is_late).length;
    const earlyLeaveCount = logs.filter((l) => l.is_early_leave).length;
    const leaveDaysCount = new Set(leaves.map((l) => l.work_date)).size;

    return res.status(200).json({
      employee_name: employee.full_name,
      month_label: monthLabelIstanbul(),
      days_worked: workDates.size,
      total_hours: Math.round((totalMinutes / 60) * 10) / 10,
      late_count: lateCount,
      early_leave_count: earlyLeaveCount,
      leave_days_count: leaveDaysCount,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
