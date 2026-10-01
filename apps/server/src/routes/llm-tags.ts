import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";

export const llmTagRoutes = new Hono().get("/", async (c) => {
  const s = await requireOrgSession(c);
  if (!s) return c.json({ error: "unauthorized" }, 401);

  let query = db.selectFrom("llm_tag").select("name").where("organizationId", "=", s.organizationId).orderBy("name", "asc");

  const q = c.req.query("q");
  if (q) query = query.where("name", "ilike", `%${q}%`);

  const rows = await query.execute();
  return c.json(rows.map((r) => r.name));
});
