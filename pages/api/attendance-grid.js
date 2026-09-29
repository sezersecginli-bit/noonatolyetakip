import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { requireAdmin } from "../../lib/requireAdmin";

function dateRange(start, end) {
  const dates = [];
  const cur = new Date(start + "T12:00:00Z");
  const last = new Date(end + "T12:00:00Z");
  while (cur <= last) {
    dates.push(new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function isWeekendStr(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  const wd = d.getUTCDay();
  return wd === 0 || wd === 6;
}

function timeStrToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

const LEAVE_CODE = {
  resmi_tatil: "H",
  yillik_izin: "V",
  hastalik: "S",
  mazeret: "M",
  diger: "M",
};

export default async function handler(req, res) {
  const user = await requireAdmin(req);
  if (!user) return res.status(401).json({ error: "Yetkisiz erişim." });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: "start ve end zorunludur." });

    const { data: employees, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, department, daily_wage")
      .eq("is_active", true)
      .order("full_name");
    if (empErr) throw empErr;

    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from("work_settings")
      .select("work_start, work_end")
      .eq("id", 1)
      .single();
    if (settingsErr) throw settingsErr;
    const expectedMinutes = timeStrToMinutes(settings.work_end) - timeStrToMinutes(settings.work_start);

    const { data: logs, error: logErr } = await supabaseAdmin
      .from("attendance_logs")
      .select("employee_id, work_date, log_type, is_late, is_early_leave, work_duration_min, location")
      .gte("work_date", start)
      .lte("work_date", end);
    if (logErr) throw logErr;

    const { data: leaves, error: leaveErr } = await supabaseAdmin
      .from("leave_days")
      .select("employee_id, work_date, leave_type")
      .gte("work_date", start)
      .lte("work_date", end);
    if (leaveErr) throw leaveErr;

    const companyLeaves = {}; // work_date -> leave_type
    leaves.filter((l) => l.employee_id === null).forEach((l) => { companyLeaves[l.work_date] = l.leave_type; });
    const personalLeaves = {}; // employee_id_work_date -> leave_type
    leaves.filter((l) => l.employee_id !== null).forEach((l) => { personalLeaves[`${l.employee_id}_${l.work_date}`] = l.leave_type; });

    const days = dateRange(start, end);

    const cells = {};
    const totals = {};

    for (const emp of employees) {
      cells[emp.id] = {};
      let workedDays = 0;
      let totalPay = 0;

      for (const day of days) {
        const dayLogs = logs.filter((l) => l.employee_id === emp.id && l.work_date === day);
        const weekend = isWeekendStr(day);
        const leaveType = personalLeaves[`${emp.id}_${day}`] || companyLeaves[day] || null;

        const workedMinutes = dayLogs
          .filter((l) => l.log_type === "out" && l.work_duration_min)
          .reduce((s, l) => s + l.work_duration_min, 0);
        const overtimeMinutes = Math.max(0, workedMinutes - expectedMinutes);
        const isLate = dayLogs.some((l) => l.is_late);
        const isEarly = dayLogs.some((l) => l.is_early_leave);
        const location = dayLogs.some((l) => l.location === "saha") ? "saha" : "atolye";

        let code = "";
        if (dayLogs.length > 0) {
          if (weekend) code = "WH";
          else if (overtimeMinutes > 0) code = "O";
          else code = "W";
          workedDays += 1;
        } else if (leaveType) {
          code = LEAVE_CODE[leaveType] || "İ";
        }
        // else: gelmedi -> boş kod

        cells[emp.id][day] = {
          code,
          is_late: isLate,
          is_early_leave: isEarly,
          location,
          worked_hours: Math.round((workedMinutes / 60) * 10) / 10,
        };
      }

      cells[emp.id].__workedDays = workedDays;
      totals[emp.id] = { workedDays };
    }

    return res.status(200).json({
      employees: employees.map((e) => ({ id: e.id, full_name: e.full_name, department: e.department, daily_wage: e.daily_wage })),
      days,
      cells,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
