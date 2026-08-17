import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { requireAdmin } from "../../lib/requireAdmin";

export default async function handler(req, res) {
  const user = await requireAdmin(req);
  if (!user) return res.status(401).json({ error: "Yetkisiz erişim." });

  try {
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("issue_reports")
        .select("*, employees(full_name)")
        .order("resolved", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;

      const issues = data.map((i) => ({
        id: i.id,
        full_name: i.employees?.full_name || "—",
        work_date: i.work_date,
        note: i.note,
        resolved: i.resolved,
        created_at: i.created_at,
      }));
      return res.status(200).json({ issues });
    }

    if (req.method === "PATCH") {
      const { id, resolved } = req.body;
      if (!id) return res.status(400).json({ error: "id zorunludur." });
      const { error } = await supabaseAdmin
        .from("issue_reports")
        .update({ resolved: !!resolved })
        .eq("id", id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id zorunludur." });
      const { error } = await supabaseAdmin.from("issue_reports").delete().eq("id", id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
