import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { distanceMeters } from "../../lib/geo";

// İstanbul zaman dilimine göre bugünün tarihini YYYY-MM-DD döndürür
function todayIstanbul() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // en-CA -> YYYY-MM-DD
}

function nowIstanbulParts() {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = fmt.format(new Date()).split(":").map(Number);
  return { h, m, minutes: h * 60 + m };
}

function timeStrToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { qr_token, forced_type, lat, lng } = req.body;

    if (!qr_token) {
      return res.status(400).json({ error: "QR kod bulunamadı." });
    }

    // 1) Çalışanı bul
    const { data: employee, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("qr_token", qr_token)
      .eq("is_active", true)
      .maybeSingle();

    if (empErr) throw empErr;
    if (!employee) {
      return res.status(404).json({ error: "Bu QR koda ait aktif personel bulunamadı." });
    }

    // 2) Genel ayarları çek
    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from("work_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (settingsErr) throw settingsErr;

    // 3) GPS doğrulama (opsiyonel)
    let distance_ok = null;
    if (settings.geo_required) {
      if (lat == null || lng == null) {
        return res.status(400).json({
          error: "Konum bilgisi alınamadı. Konum izni vermeden QR okutulamaz.",
        });
      }
      if (settings.workplace_lat != null && settings.workplace_lng != null) {
        const dist = distanceMeters(lat, lng, settings.workplace_lat, settings.workplace_lng);
        distance_ok = dist <= settings.geo_radius_meters;
        if (!distance_ok) {
          return res.status(403).json({
            error: `İşyeri konumundan çok uzaktasınız (${Math.round(dist)} m). Giriş/çıkış kaydedilemedi.`,
          });
        }
      }
    }

    const work_date = todayIstanbul();

    // 4) Bugünün son kaydını bul -> giriş mi çıkış mı otomatik belirle
    const { data: lastLog, error: lastErr } = await supabaseAdmin
      .from("attendance_logs")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("work_date", work_date)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastErr) throw lastErr;

    let log_type;
    if (forced_type === "in" || forced_type === "out") {
      log_type = forced_type;
    } else {
      // otomatik algılama: son kayıt yoksa veya son kayıt "out" ise -> "in"
      log_type = !lastLog || lastLog.log_type === "out" ? "in" : "out";
    }

    // Aynı tip art arda okutulmasını engelle (yanlışlıkla çift okutma)
    if (lastLog && lastLog.log_type === log_type) {
      return res.status(409).json({
        error:
          log_type === "in"
            ? "Zaten giriş yapılmış. Çıkış için tekrar okutun."
            : "Zaten çıkış yapılmış. Giriş için tekrar okutun.",
        employee_name: employee.full_name,
      });
    }

    const { minutes: nowMinutes } = nowIstanbulParts();

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
        lat: lat ?? null,
        lng: lng ?? null,
        distance_ok,
        work_duration_min,
        location: "atolye",
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
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
