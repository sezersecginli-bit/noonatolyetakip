import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { requireAdmin } from "../../lib/requireAdmin";

function timeStrToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// work_date "YYYY-MM-DD" -> hafta sonu mu? (Cumartesi=6, Pazar=0)
function isWeekend(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z"); // öğlen kullanarak gün kaymasını önlüyoruz
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

export default async function handler(req, res) {
  const user = await requireAdmin(req);
  if (!user) return res.status(401).json({ error: "Yetkisiz erişim." });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { start, end, employee_id } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: "start ve end (YYYY-MM-DD) zorunludur." });
    }

    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from("work_settings")
      .select("work_start, work_end")
      .eq("id", 1)
      .single();
    if (settingsErr) throw settingsErr;

    const expectedMinutes = timeStrToMinutes(settings.work_end) - timeStrToMinutes(settings.work_start);

    let empQuery = supabaseAdmin
      .from("employees")
      .select("id, full_name, daily_wage, overtime_hourly_rate, early_leave_deduction_hourly, weekend_multiplier")
      .eq("is_active", true);
    if (employee_id) empQuery = empQuery.eq("id", employee_id);
    const { data: employees, error: empErr } = await empQuery;
    if (empErr) throw empErr;

    let logQuery = supabaseAdmin
      .from("attendance_logs")
      .select("*")
      .gte("work_date", start)
      .lte("work_date", end)
      .order("logged_at", { ascending: true });
    if (employee_id) logQuery = logQuery.eq("employee_id", employee_id);
    const { data: logs, error: logErr } = await logQuery;
    if (logErr) throw logErr;

    const { data: leaves, error: leaveErr } = await supabaseAdmin
      .from("leave_days")
      .select("*")
      .gte("work_date", start)
      .lte("work_date", end);
    if (leaveErr) throw leaveErr;

    const companyLeaves = leaves.filter((l) => l.employee_id === null);

    const result = employees.map((emp) => {
      const empLogs = logs.filter((l) => l.employee_id === emp.id);
      const dayMap = {};
      for (const l of empLogs) {
        if (!dayMap[l.work_date]) dayMap[l.work_date] = [];
        dayMap[l.work_date].push(l);
      }

      const days = Object.keys(dayMap).sort().map((work_date) => {
        const dayLogs = dayMap[work_date];
        const weekend = isWeekend(work_date);

        const workedMinutes = dayLogs
          .filter((l) => l.log_type === "out" && l.work_duration_min)
          .reduce((sum, l) => sum + l.work_duration_min, 0);

        const hadEarlyLeave = dayLogs.some((l) => l.is_early_leave);
        const hadLate = dayLogs.some((l) => l.is_late);

        const base = weekend ? emp.daily_wage * emp.weekend_multiplier : emp.daily_wage;

        const overtimeMinutes = Math.max(0, workedMinutes - expectedMinutes);
        const overtimePay = (overtimeMinutes / 60) * emp.overtime_hourly_rate;

        const missingMinutes = hadEarlyLeave ? Math.max(0, expectedMinutes - workedMinutes) : 0;
        const deduction = (missingMinutes / 60) * emp.early_leave_deduction_hourly;

        const total = Math.round((base + overtimePay - deduction) * 100) / 100;

        return {
          work_date,
          weekend,
          worked_hours: Math.round((workedMinutes / 60) * 100) / 100,
          overtime_hours: Math.round((overtimeMinutes / 60) * 100) / 100,
          is_late: hadLate,
          is_early_leave: hadEarlyLeave,
          base_pay: Math.round(base * 100) / 100,
          overtime_pay: Math.round(overtimePay * 100) / 100,
          deduction: Math.round(deduction * 100) / 100,
          total_pay: total,
          is_leave: false,
        };
      });

      // İzinli günleri ekle (bu gün için zaten bir giriş/çıkış kaydı yoksa)
      const personalLeaves = leaves.filter((l) => l.employee_id === emp.id);
      const allLeavesForEmp = [...personalLeaves, ...companyLeaves];
      const seenDates = new Set(days.map((d) => d.work_date));
      const uniqueLeaveDates = new Map();
      for (const l of allLeavesForEmp) {
        if (!seenDates.has(l.work_date) && !uniqueLeaveDates.has(l.work_date)) {
          uniqueLeaveDates.set(l.work_date, l);
        }
      }

      for (const [work_date, leave] of uniqueLeaveDates) {
        const pay = leave.paid ? emp.daily_wage : 0;
        days.push({
          work_date,
          weekend: isWeekend(work_date),
          worked_hours: 0,
          overtime_hours: 0,
          is_late: false,
          is_early_leave: false,
          base_pay: Math.round(pay * 100) / 100,
          overtime_pay: 0,
          deduction: 0,
          total_pay: Math.round(pay * 100) / 100,
          is_leave: true,
          leave_type: leave.leave_type,
          leave_paid: leave.paid,
        });
      }
      days.sort((a, b) => (a.work_date < b.work_date ? -1 : 1));

      const totalPay = Math.round(days.reduce((s, d) => s + d.total_pay, 0) * 100) / 100;

      return {
        employee_id: emp.id,
        full_name: emp.full_name,
        daily_wage: emp.daily_wage,
        overtime_hourly_rate: emp.overtime_hourly_rate,
        early_leave_deduction_hourly: emp.early_leave_deduction_hourly,
        weekend_multiplier: emp.weekend_multiplier,
        days,
        days_worked: days.filter((d) => !d.is_leave).length,
        days_leave: days.filter((d) => d.is_leave).length,
        total_pay: totalPay,
      };
    });

    return res.status(200).json({ payroll: result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
