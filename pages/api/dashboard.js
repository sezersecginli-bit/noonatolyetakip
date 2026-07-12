import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { requireAdmin } from "../../lib/requireAdmin";

function todayIstanbul() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
  return fmt.format(new Date());
}

export default async function handler(req, res) {
  const user = await requireAdmin(req);
  if (!user) return res.status(401).json({ error: "Yetkisiz erişim." });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const date = req.query.date || todayIstanbul();

    const { data: employees, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, department, is_active")
      .eq("is_active", true)
      .order("full_name");
    if (empErr) throw empErr;

    const { data: logs, error: logErr } = await supabaseAdmin
      .from("attendance_logs")
      .select("*")
      .eq("work_date", date)
      .order("logged_at", { ascending: true });
    if (logErr) throw logErr;

    const { data: leaves, error: leaveErr } = await supabaseAdmin
      .from("leave_days")
      .select("*")
      .eq("work_date", date);
    if (leaveErr) throw leaveErr;

    const companyWideLeave = leaves.find((l) => l.employee_id === null) || null;

    // Her çalışan için o günkü durumu özetle
    const summary = employees.map((emp) => {
      const empLogs = logs.filter((l) => l.employee_id === emp.id);
      const firstIn = empLogs.find((l) => l.log_type === "in");
      const lastOut = [...empLogs].reverse().find((l) => l.log_type === "out");
      const hasSaha = empLogs.some((l) => l.location === "saha");
      const sahaLabel = empLogs.find((l) => l.location === "saha" && l.site_label)?.site_label || null;

      const personalLeave = leaves.find((l) => l.employee_id === emp.id) || null;
      const leave = personalLeave || companyWideLeave;

      let status;
      if (empLogs.length > 0) {
        status = lastOut ? "cikti" : "icerde";
      } else if (leave) {
        status = "izinli";
      } else {
        status = "gelmedi";
      }

      return {
        employee_id: emp.id,
        full_name: emp.full_name,
        department: emp.department,
        status, // gelmedi | icerde | cikti | izinli
        check_in: firstIn?.logged_at || null,
        check_out: lastOut?.logged_at || null,
        is_late: firstIn?.is_late || false,
        is_early_leave: lastOut?.is_early_leave || false,
        work_duration_min: lastOut?.work_duration_min || null,
        location: hasSaha ? "saha" : "atolye",
        site_label: sahaLabel,
        leave_type: status === "izinli" ? leave.leave_type : null,
        leave_paid: status === "izinli" ? leave.paid : null,
        logs: empLogs,
      };
    });

    return res.status(200).json({ date, summary });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
