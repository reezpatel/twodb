import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { runnerManager } from "../lib/runner-manager";

export const runnerRoutes = new Hono()
  .get("/runners", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const rows = await db.selectFrom("runner").selectAll().where("organizationId", "=", s.organizationId).where("deletedAt", "is", null).execute();

    const online = runnerManager.onlineIds();
    const runners = rows
      .map((r) => ({ ...r, online: online.has(r.id) }))
      .sort((a, b) => Number(b.online) - Number(a.online) || +new Date(b.lastSeenAt) - +new Date(a.lastSeenAt));
    return c.json(runners);
  })

  // POSIX runners exec via /bin/sh -c; the path travels base64-encoded so any
  // characters survive the shell round-trip. Node is guaranteed on runners.
  .get("/runners/:id/fs", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const runnerId = c.req.param("id");
    const runner = await db
      .selectFrom("runner")
      .select("id")
      .where("id", "=", runnerId)
      .where("organizationId", "=", s.organizationId)
      .where("deletedAt", "is", null)
      .executeTakeFirst();
    if (!runner) return c.json({ error: "runner_not_found" }, 404);

    const encoded = Buffer.from(c.req.query("path") ?? "~", "utf8").toString("base64");
    const script = `const fs=require("fs"),os=require("os");let p=Buffer.from("${encoded}","base64").toString("utf8");if(p==="~")p=os.homedir();else if(p.startsWith("~/"))p=os.homedir()+p.slice(1);let o;try{const a=[];for(const e of fs.readdirSync(p,{withFileTypes:true}))a.push({name:e.name,dir:e.isDirectory()});o={path:p,entries:a}}catch(x){o={error:x.message}}console.log(JSON.stringify(o))`;

    let result: { stdout: string; stderr: string; code: number };
    try {
      result = await runnerManager.execOnRunner(runnerId, `node -e '${script}'`, undefined, { waitMs: 0 });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "runner offline" }, 502);
    }
    if (result.code !== 0) {
      return c.json({ error: result.stderr.trim() || `runner exited with code ${result.code}` }, 502);
    }

    try {
      const out = JSON.parse(result.stdout.trim()) as { path?: string; entries?: { name: string; dir: boolean }[]; error?: string };
      if (out.error) return c.json({ error: out.error }, 400);
      return c.json({ path: out.path, entries: out.entries ?? [] });
    } catch {
      return c.json({ error: "runner returned an unreadable directory listing" }, 502);
    }
  })

  .delete("/runners/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db
      .updateTable("runner")
      .set({ deletedAt: new Date() })
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .where("deletedAt", "is", null)
      .returning("id")
      .executeTakeFirst();
    if (!row) return c.json({ error: "runner_not_found" }, 404);

    runnerManager.disconnect(row.id);
    return c.json({ ok: true });
  })

  .get("/runner-keys", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const rows = await db
      .selectFrom("runner_access_key")
      .select(["id", "name", "key", "createdAt", "revokedAt"])
      .where("organizationId", "=", s.organizationId)
      .orderBy("createdAt", "desc")
      .execute();
    return c.json(rows.map(({ key, ...rest }) => ({ ...rest, prefix: key.slice(0, 12) })));
  })

  .post("/runner-keys", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "default";

    const row = await db
      .insertInto("runner_access_key")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        name,
        key: `twr_${crypto.randomUUID().replaceAll("-", "")}`,
        createdAt: new Date(),
        revokedAt: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row, 201);
  })

  .delete("/runner-keys/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db
      .updateTable("runner_access_key")
      .set({ revokedAt: new Date() })
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .where("revokedAt", "is", null)
      .returning("id")
      .executeTakeFirst();
    if (!row) return c.json({ error: "key_not_found" }, 404);
    return c.json({ ok: true });
  });
