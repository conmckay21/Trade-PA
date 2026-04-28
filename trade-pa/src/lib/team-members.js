// ─── team_members read helpers ────────────────────────────────────────────
// Hoisted from App.jsx during P7 prelude (28 Apr 2026). Verbatim move —
// no behavioural changes. Used heavily by AIAssistant (9 + 11 calls) and
// SubcontractorsTab (5 calls). Both functions read from the unified
// team_members table and shape rows back into the legacy worker/sub
// shapes that callers expect (engagement → type, company_name → company,
// etc).
//
// db is passed in rather than imported here so callers can use either the
// stub-able client from lib/db.js or window._supabase if needed.

export async function tmReadWorkers(db, userId, opts = {}) {
  if (!db || !userId) return { data: [], error: null };
  const { activeOnly = false, nameLike = null, limit = null } = opts;
  let q = db.from("team_members").select("*")
    .eq("user_id", userId).eq("source_table", "workers");
  if (activeOnly) q = q.eq("active", true);
  if (nameLike) q = q.ilike("name", `%${nameLike}%`);
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) return { data: null, error };
  return {
    data: (data || []).map(r => ({
      id: r.id,
      user_id: r.user_id,
      name: r.name,
      type: r.engagement === "employed" ? "employed" : "subcontractor",
      role: r.role,
      email: r.email,
      phone: r.phone,
      day_rate: r.day_rate,
      hourly_rate: r.hourly_rate,
      utr: r.utr,
      cis_rate: r.cis_rate,
      ni_number: r.ni_number,
      start_date: r.start_date,
      active: r.active,
      notes: r.notes,
      address: r.address,
      created_at: r.created_at,
    })),
    error: null,
  };
}

export async function tmReadSubs(db, userId, opts = {}) {
  if (!db || !userId) return { data: [], error: null };
  const { activeOnly = false, nameLike = null, limit = null } = opts;
  let q = db.from("team_members").select("*")
    .eq("user_id", userId).eq("source_table", "subcontractors");
  if (activeOnly) q = q.eq("active", true);
  if (nameLike) q = q.ilike("name", `%${nameLike}%`);
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) return { data: null, error };
  return {
    data: (data || []).map(r => ({
      id: r.id,
      user_id: r.user_id,
      name: r.name,
      company: r.company_name,
      utr: r.utr,
      cis_rate: r.cis_rate,
      email: r.email,
      phone: r.phone,
      active: r.active,
      created_at: r.created_at,
    })),
    error: null,
  };
}
