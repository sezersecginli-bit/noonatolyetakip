import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { requireAdmin } from "../../lib/requireAdmin";

export default async function handler(req, res) {
  const user = await requireAdmin(req);
  if (!user) return res.status(401).json({ error: "Yetkisiz erişim." });

  try {
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("employees")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json({ employees: data });
    }

    if (req.method === "POST") {
      const { full_name, department, daily_wage, overtime_hourly_rate, early_leave_deduction_hourly, weekend_multiplier } = req.body;
      if (!full_name?.trim()) {
        return res.status(400).json({ error: "Ad soyad zorunludur." });
      }
      const { data, error } = await supabaseAdmin
        .from("employees")
        .insert({
          full_name: full_name.trim(),
          department: department?.trim() || null,
          daily_wage: daily_wage ?? 0,
          overtime_hourly_rate: overtime_hourly_rate ?? 0,
          early_leave_deduction_hourly: early_leave_deduction_hourly ?? 0,
          weekend_multiplier: weekend_multiplier ?? 1.5,
        })
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ employee: data });
    }

    if (req.method === "PATCH") {
      const { id, full_name, department, is_active, daily_wage, overtime_hourly_rate, early_leave_deduction_hourly, weekend_multiplier } = req.body;
      if (!id) return res.status(400).json({ error: "id zorunludur." });
      const update = {};
      if (full_name !== undefined) update.full_name = full_name;
      if (department !== undefined) update.department = department;
      if (is_active !== undefined) update.is_active = is_active;
      if (daily_wage !== undefined) update.daily_wage = daily_wage;
      if (overtime_hourly_rate !== undefined) update.overtime_hourly_rate = overtime_hourly_rate;
      if (early_leave_deduction_hourly !== undefined) update.early_leave_deduction_hourly = early_leave_deduction_hourly;
      if (weekend_multiplier !== undefined) update.weekend_multiplier = weekend_multiplier;

      const { data, error } = await supabaseAdmin
        .from("employees")
        .update(update)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ employee: data });
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id zorunludur." });
      const { error } = await supabaseAdmin.from("employees").delete().eq("id", id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
