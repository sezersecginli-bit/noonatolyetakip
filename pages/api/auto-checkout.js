import { supabaseAdmin } from "../../lib/supabaseAdmin";

// Bu endpoint sadece Vercel Cron tarafından çağrılır (vercel.json'daki
// "crons" tanımı). Vercel, CRON_SECRET ortam değişkenini otomatik olarak
// Authorization header'ı olarak gönderir; bu yüzden bu satırlar dışarıdan
// rastgele çağrılmaya karşı güvenlidir.

// Türkiye 2016'dan beri yaz saati uygulamıyor, sabit UTC+3.
function yesterdayIstanbul() {
  const now = new Date();
  const istanbulNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  istanbulNow.setDate(istanbulNow.getDate() - 1);
  const y = istanbulNow.getFullYear();
  const m = String(istanbulNow.getMonth() + 1).padStart(2, "0");
  const d = String(istanbulNow.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || "";
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const work_date = yesterdayIstanbul();

    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from("work_settings")
      .select("work_end")
      .eq("id", 1)
      .single();
    if (settingsErr) throw settingsErr;

    const { data: logs, error: logsErr } = await supabaseAdmin
      .from("attendance_logs")
      .select("*")
      .eq("work_date", work_date)
      .order("logged_at", { ascending: true });
    if (logsErr) throw logsErr;

    // Her çalışan için o günün en son kaydını bul (ascending sıralı olduğu
    // için son atanan değer en güncel kayıt olur)
    const lastByEmployee = {};
    for (const l of logs) {
      lastByEmployee[l.employee_id] = l;
    }

    // Son kaydı "giriş" olan (yani çıkışı unutulmuş) çalışanları bul
    const toClose = Object.values(lastByEmployee).filter((l) => l.log_type === "in");

    let closedCount = 0;
    for (const inLog of toClose) {
      const logged_at = `${work_date}T${settings.work_end}:00+03:00`;
      const diffMs = new Date(logged_at) - new Date(inLog.logged_at);
      const work_duration_min = Math.max(0, Math.round(diffMs / 60000));

      const { error: insertErr } = await supabaseAdmin.from("attendance_logs").insert({
        employee_id: inLog.employee_id,
        log_type: "out",
        work_date,
        logged_at,
        is_late: false,
        is_early_leave: false,
        work_duration_min,
        location: inLog.location || "atolye",
        site_label: inLog.site_label || null,
      });
      if (insertErr) throw insertErr;
      closedCount += 1;
    }

    return res.status(200).json({ success: true, work_date, closed: closedCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
