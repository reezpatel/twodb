import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { runnerManager } from "../lib/runner-manager";
import { latestMetrics, runnerMetricsHistory } from "../lib/runner-metrics";

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
  // characters survive the shell round-trip. Node is guaranteed on runners:
  // the runner itself runs on node (the nix package wraps nodejs, the image is
  // node:22-slim) and prepends its runtime to the exec PATH.
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

  // Disk paths reported in this runner's metrics — configured from the UI.
  .patch("/runners/:id/disks", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const runnerId = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    const raw = Array.isArray(body?.paths) ? body.paths : null;
    if (!raw) return c.json({ error: "paths_required" }, 400);
    // Absolute paths only, deduped, capped at a sane number.
    const paths = [...new Set(raw.filter((p: unknown) => typeof p === "string" && p.startsWith("/")))].slice(0, 16) as string[];

    const row = await db
      .updateTable("runner")
      .set({ diskPaths: JSON.stringify(paths) })
      .where("id", "=", runnerId)
      .where("organizationId", "=", s.organizationId)
      .where("deletedAt", "is", null)
      .returningAll()
      .executeTakeFirst();
    if (!row) return c.json({ error: "runner_not_found" }, 404);

    // Push to a connected runner so the next 10s sample covers it.
    runnerManager.sendToRunnerRaw(runnerId, { type: "metricsConfig", diskPaths: paths });
    const { setLocalDiskPaths, localRunnerId } = await import("../lib/local-runner");
    if (localRunnerId() === runnerId) setLocalDiskPaths(paths);
    return c.json({ ok: true, paths });
  })

  // Metrics history for charts — ?hours=720 (30d default, capped there).
  .get("/runners/:id/metrics", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const runnerId = c.req.param("id");
    const owned = await db
      .selectFrom("runner")
      .select("id")
      .where("id", "=", runnerId)
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!owned) return c.json({ error: "runner_not_found" }, 404);

    const hoursRaw = Number(c.req.query("hours") ?? "720");
    const hours = Number.isFinite(hoursRaw) ? Math.min(Math.max(hoursRaw, 1), 720) : 720;
    const rows = await runnerMetricsHistory(runnerId, hours);
    return c.json(rows.map((r) => ({ at: r.at, cpu: r.cpu, memory: r.memory, gpus: r.gpus, disks: r.disks })));
  })

  // Latest live sample (null when the runner has never reported).
  .get("/runners/:id/metrics/latest", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const runnerId = c.req.param("id");
    const owned = await db
      .selectFrom("runner")
      .select("id")
      .where("id", "=", runnerId)
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!owned) return c.json({ error: "runner_not_found" }, 404);

    return c.json(latestMetrics(runnerId));
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
