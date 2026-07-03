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
    const { date, start, end } = req.query;

    let query = supabaseAdmin
      .from("field_notes")
      .select("*, employees(full_name, department)")
      .order("work_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (start && end) {
      query = query.gte("work_date", start).lte("work_date", end);
    } else {
      query = query.eq("work_date", date || todayIstanbul());
    }

    const { data, error } = await query;
    if (error) throw error;

    const notes = data.map((n) => ({
      id: n.id,
      full_name: n.employees?.full_name || "—",
      department: n.employees?.department || "",
      work_date: n.work_date,
      note: n.note,
      created_at: n.created_at,
    }));

    return res.status(200).json({ notes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
