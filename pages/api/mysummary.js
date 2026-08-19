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

function fmtRangeLabel(start, end) {
  const [sy, sm, sd] = start.split("-");
  const [ey, em, ed] = end.split("-");
  return `${sd}.${sm}.${sy} – ${ed}.${em}.${ey}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { qr_token, employee_id, pin_code, start: reqStart, end: reqEnd } = req.body;

    let employee;
    if (qr_token) {
      const { data, error: empErr } = await supabaseAdmin
        .from("employees")
        .select("id, full_name")
        .eq("qr_token", qr_token)
        .eq("is_active", true)
        .maybeSingle();
      if (empErr) throw empErr;
      employee = data;
      if (!employee) return res.status(404).json({ error: "Bu QR koda ait aktif personel bulunamadı." });
    } else if (employee_id && pin_code) {
      const { data, error: empErr } = await supabaseAdmin
        .from("employees")
        .select("id, full_name, pin_code")
        .eq("id", employee_id)
        .eq("is_active", true)
        .maybeSingle();
      if (empErr) throw empErr;
      if (!data) return res.status(404).json({ error: "Personel bulunamadı." });
      if (!data.pin_code) {
        return res.status(403).json({ error: "Bu personel için henüz bir PIN tanımlanmamış. Yöneticinize başvurun." });
      }
      if (data.pin_code !== pin_code.trim()) {
        return res.status(403).json({ error: "PIN hatalı." });
      }
      employee = data;
    } else {
      return res.status(400).json({ error: "Kimlik doğrulama bilgisi eksik." });
    }

    const start = reqStart || firstOfMonthIstanbul();
    const end = reqEnd || todayIstanbul();

    if (start > end) {
      return res.status(400).json({ error: "Başlangıç tarihi bitiş tarihinden sonra olamaz." });
    }

    const { data: logs, error: logErr } = await supabaseAdmin
      .from("attendance_logs")
      .select("work_date, log_type, logged_at, is_late, is_early_leave, work_duration_min, location, site_label")
      .eq("employee_id", employee.id)
      .gte("work_date", start)
      .lte("work_date", end)
      .order("logged_at", { ascending: true });
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

    // Gün gün detay: her tarih için ilk giriş, son çıkış, o günkü toplam süre
    const dayMap = {};
    for (const l of logs) {
      if (!dayMap[l.work_date]) dayMap[l.work_date] = [];
      dayMap[l.work_date].push(l);
    }
    const days = Object.keys(dayMap).sort().reverse().map((work_date) => {
      const dayLogs = dayMap[work_date];
      const firstIn = dayLogs.find((l) => l.log_type === "in");
      const lastOut = [...dayLogs].reverse().find((l) => l.log_type === "out");
      const dayMinutes = dayLogs
        .filter((l) => l.log_type === "out" && l.work_duration_min)
        .reduce((sum, l) => sum + l.work_duration_min, 0);
      const hasSaha = dayLogs.some((l) => l.location === "saha");
      return {
        work_date,
        check_in: firstIn?.logged_at || null,
        check_out: lastOut?.logged_at || null,
        work_duration_min: dayMinutes || null,
        is_late: dayLogs.some((l) => l.is_late),
        is_early_leave: dayLogs.some((l) => l.is_early_leave),
        location: hasSaha ? "saha" : "atolye",
      };
    });

    return res.status(200).json({
      employee_name: employee.full_name,
      month_label: fmtRangeLabel(start, end),
      days_worked: workDates.size,
      total_hours: Math.round((totalMinutes / 60) * 10) / 10,
      late_count: lateCount,
      early_leave_count: earlyLeaveCount,
      leave_days_count: leaveDaysCount,
      days,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
