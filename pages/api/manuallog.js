import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { requireAdmin } from "../../lib/requireAdmin";

// Not: Türkiye 2016'dan beri yaz saati uygulamıyor, sabit UTC+3.
function timeStrToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Bir günün tüm kayıtlarını zaman sırasına göre yeniden hesaplar
// (geç kalma, erken çıkış, çalışma süresi). Yönetici saatleri istediği
// gibi değiştirebildiği için, her değişiklikten sonra bu fonksiyon
// tüm günü baştan tutarlı hale getirir.
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

    // Not: burada artık "zaten bir giriş/çıkış var" diye engelleme YOK.
    // Yönetici olarak istediğin saatleri, istediğin sırayla ekleyebilirsin.
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("attendance_logs")
      .insert({
        employee_id,
        log_type,
        work_date,
        logged_at,
        location: "atolye",
        is_late: false,
        is_early_leave: false,
        work_duration_min: null,
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    // Günün tüm kayıtlarını (yeni eklenen dahil) tutarlı hale getir
    await recalcDay(employee_id, work_date, settings);

    return res.status(200).json({ success: true, log: inserted, employee_name: employee.full_name });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
