import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { getCodeSettings, setCodeSettings } from "../lib/code-settings";
import { readGitStatus } from "../lib/git-status";
import { runnerManager } from "../lib/runner-manager";
import type { CodeSessionMode, CodeSessionType } from "../plugins/db";

export const codeRoutes = new Hono()
  .get("/directories/:id/files", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const dir = await db
      .selectFrom("code_directory")
      .select(["id", "runnerId", "cwd"])
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!dir) return c.json({ error: "directory_not_found" }, 404);

    // One pruned walk, capped — the client caches it and filters per keystroke.
    // Directories come back with a trailing slash so the UI can mark them.
    const q = (v: string) => `'${v.replace(/'/g, "'\\''")}'`;
    const script = [
      `cd ${q(dir.cwd)} 2>/dev/null || exit 9`,
      "if command -v fd >/dev/null 2>&1; then",
      "  fd --type f --hidden --exclude .git --exclude node_modules --exclude dist --exclude target --exclude .next | sed 's|^\\./||' | head -20000",
      "  fd --type d --hidden --exclude .git --exclude node_modules --exclude dist --exclude target --exclude .next | sed -e 's|^\\./||' -e 's|$|/|' | head -5000",
      "else",
      "  find . \\( -type d \\( -name .git -o -name node_modules -o -name dist -o -name target -o -name .next -o -name build \\) -prune \\) -o -type d -exec sh -c 'for d do printf \"%s/\\n\" \"$d\"; done' _ {} + -o -type f -print | sed 's|^\\./||' | head -25000",
      "fi",
    ].join("\n");

    try {
      const r = await runnerManager.execOnRunner(dir.runnerId, script, undefined, { waitMs: 0 });
      if (r.code === 9) return c.json({ error: "directory_missing" }, 409);
      if (r.code !== 0) return c.json({ error: "walk_failed", detail: r.stderr.trim().slice(0, 300) }, 500);
      const files = r.stdout
        .trim()
        .split("\n")
        .filter((f) => f && f !== "/");
      return c.json({ files });
    } catch {
      return c.json({ error: "runner_offline" }, 503);
    }
  })

  .get("/directories/:id/git-status", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const dir = await db
      .selectFrom("code_directory")
      .select(["id", "runnerId", "cwd"])
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!dir) return c.json({ error: "directory_not_found" }, 404);

    const result = await readGitStatus(dir.runnerId, dir.cwd);
    if ("error" in result) {
      const status = result.error === "runner_offline" ? 503 : result.error === "directory_missing" ? 409 : 500;
      return c.json(result.error === "git_failed" ? { error: result.error, detail: result.detail } : { error: result.error }, status);
    }
    return c.json(result);
  })

  .get("/directories/:id/git-changes", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const dir = await db
      .selectFrom("code_directory")
      .select(["id", "runnerId", "cwd"])
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!dir) return c.json({ error: "directory_not_found" }, 404);

    // numstat keeps the list O(changed files) — no patch text until a file is expanded.
    const q = (v: string) => `'${v.replace(/'/g, "'\\''")}'`;
    const script = [
      `cd ${q(dir.cwd)} 2>/dev/null || exit 9`,
      "if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then echo nogit; exit 0; fi",
      "git -c core.quotepath=false status --porcelain=v1",
      "echo --numstat--",
      "git -c diff.renames=false diff --numstat HEAD",
    ].join("\n");

    try {
      const r = await runnerManager.execOnRunner(dir.runnerId, script, undefined, { waitMs: 0 });
      if (r.code === 9) return c.json({ error: "directory_missing" }, 409);
      if (r.code !== 0) return c.json({ error: "git_failed", detail: r.stderr.trim().slice(0, 300) }, 500);

      const marker = r.stdout.indexOf("--numstat--\n");
      if (r.stdout.trim() === "nogit" || marker === -1) return c.json({ git: false });
      const statusLines = r.stdout.slice(0, marker).trim().split("\n");
      const numstatLines = r.stdout
        .slice(marker + 12)
        .trim()
        .split("\n");

      const counts = new Map<string, { additions: number | null; deletions: number | null }>();
      for (const line of numstatLines) {
        if (!line) continue;
        const [adds, dels, ...rest] = line.split("\t");
        const path = rest.join("\t");
        if (!path) continue;
        counts.set(path, { additions: adds === "-" ? null : Number(adds) || 0, deletions: dels === "-" ? null : Number(dels) || 0 });
      }

      const files = statusLines
        .filter((line) => line.length > 3)
        .map((line) => {
          const xy = line.slice(0, 2);
          let path = line.slice(3);
          let oldPath: string | null = null;
          const arrow = path.indexOf(" -> ");
          if (arrow !== -1) {
            oldPath = path.slice(0, arrow);
            path = path.slice(arrow + 4);
          }
          const status = xy === "??" ? "U" : xy[1] !== " " ? xy[1] : xy[0];
          const count = counts.get(path);
          return { path, oldPath, status, additions: count?.additions ?? null, deletions: count?.deletions ?? null };
        })
        .sort((a, b) => a.path.localeCompare(b.path));

      return c.json({ git: true, files });
    } catch {
      return c.json({ error: "runner_offline" }, 503);
    }
  })

  .get("/directories/:id/git-diff", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const dir = await db
      .selectFrom("code_directory")
      .select(["id", "runnerId", "cwd"])
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!dir) return c.json({ error: "directory_not_found" }, 404);

    let path: string;
    try {
      path = Buffer.from(c.req.query("path") ?? "", "base64").toString("utf8");
    } catch {
      return c.json({ error: "invalid_path" }, 400);
    }
    if (!path || path.startsWith("-") || /[\0\n\r]/.test(path) || path.split("/").includes("..")) {
      return c.json({ error: "invalid_path" }, 400);
    }

    const q = (v: string) => `'${v.replace(/'/g, "'\\''")}'`;
    const script = [
      `cd ${q(dir.cwd)} 2>/dev/null || exit 9`,
      `if git ls-files --error-unmatch ${q(path)} >/dev/null 2>&1; then`,
      `  git -c core.quotepath=false diff HEAD -- ${q(path)}`,
      "else",
      `  git diff --no-index -- /dev/null ${q(path)} || true`,
      "fi",
    ].join("\n");

    try {
      const r = await runnerManager.execOnRunner(dir.runnerId, script, undefined, { waitMs: 0 });
      if (r.code === 9) return c.json({ error: "directory_missing" }, 409);
      if (r.code !== 0) return c.json({ error: "git_failed", detail: r.stderr.trim().slice(0, 300) }, 500);
      return c.json({ path, diff: r.stdout });
    } catch {
      return c.json({ error: "runner_offline" }, 503);
    }
  })

  .post("/directories/:id/git-init", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const dir = await db
      .selectFrom("code_directory")
      .select(["id", "runnerId", "cwd"])
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!dir) return c.json({ error: "directory_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const branch = typeof body?.branch === "string" && body.branch.trim() ? body.branch.trim() : "main";
    const origin = typeof body?.origin === "string" ? body.origin.trim() : "";
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/.test(branch) || branch.includes("..")) return c.json({ error: "invalid_branch" }, 400);
    if (origin && !/^[A-Za-z0-9@:/._~+#?=-]+$/.test(origin)) return c.json({ error: "invalid_origin" }, 400);

    const q = (v: string) => `'${v.replace(/'/g, "'\\''")}'`;
    const script = [
      `cd ${q(dir.cwd)} 2>/dev/null || exit 9`,
      `git init -b ${q(branch)} || exit 10`,
      ...(origin ? [`git remote add origin ${q(origin)} 2>/dev/null || git remote set-url origin ${q(origin)} || exit 11`] : []),
      "git rev-parse --is-inside-work-tree",
    ].join("\n");

    try {
      const r = await runnerManager.execOnRunner(dir.runnerId, script, undefined, { waitMs: 0 });
      if (r.code === 9) return c.json({ error: "directory_missing" }, 409);
      if (r.code !== 0) return c.json({ error: "git_failed", detail: (r.stderr.trim() || r.stdout.trim()).slice(0, 300) }, 500);
      return c.json({ ok: true });
    } catch {
      return c.json({ error: "runner_offline" }, 503);
    }
  })

  .get("/sessions/:id/checkpoints", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const session = await db
      .selectFrom("code_session")
      .select("id")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!session) return c.json({ error: "session_not_found" }, 404);

    const rows = await db.selectFrom("code_checkpoint").selectAll().where("sessionId", "=", session.id).orderBy("createdAt", "desc").execute();
    return c.json(rows);
  })

  .post("/sessions/:id/checkpoints", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim().slice(0, 200) : null;

    const session = await db
      .selectFrom("code_session")
      .select(["id", "codeDirectoryId"])
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!session) return c.json({ error: "session_not_found" }, 404);
    if (!session.codeDirectoryId) return c.json({ error: "no_directory" }, 409);

    const dir = await db.selectFrom("code_directory").select(["id", "runnerId", "cwd"]).where("id", "=", session.codeDirectoryId).executeTakeFirst();
    if (!dir) return c.json({ error: "directory_not_found" }, 404);

    // Snapshot via a temp GIT_INDEX_FILE so the user's staged state is never
    // touched; the commit lands on a hidden ref, HEAD and branches stay put.
    const id = crypto.randomUUID();
    const q = (v: string) => `'${v.replace(/'/g, "'\\''")}'`;
    const script = [
      `cd ${q(dir.cwd)} 2>/dev/null || exit 9`,
      `T=$(mktemp) || exit 10`,
      `GIT_INDEX_FILE=$T`,
      `export GIT_INDEX_FILE`,
      `git read-tree HEAD 2>/dev/null`,
      `git add -A`,
      `TREE=$(git write-tree 2>/dev/null) || exit 11`,
      `rm -f $T`,
      `PARENT=$(git rev-parse --verify -q HEAD)`,
      `if [ -n "$PARENT" ]; then`,
      `  C=$(git commit-tree $TREE -p $PARENT -m "twodb checkpoint")`,
      `else`,
      `  C=$(git commit-tree $TREE -m "twodb checkpoint")`,
      `fi`,
      `[ -n "$C" ] || exit 12`,
      `git update-ref refs/twodb/checkpoints/${id} $C || exit 13`,
      `echo $C`,
    ].join("\n");

    try {
      const r = await runnerManager.execOnRunner(dir.runnerId, script, undefined, { waitMs: 0 });
      if (r.code === 9) return c.json({ error: "directory_missing" }, 409);
      if (r.code !== 0) return c.json({ error: "checkpoint_failed", detail: r.stderr.trim().slice(0, 300) }, 500);
      const sha = (r.stdout.trim().split("\n").pop() ?? "").trim();
      if (!/^[0-9a-f]{40,64}$/.test(sha)) return c.json({ error: "checkpoint_failed" }, 500);

      const row = await db
        .insertInto("code_checkpoint")
        .values({
          id,
          organizationId: s.organizationId,
          sessionId: session.id,
          codeDirectoryId: dir.id,
          label,
          ref: `refs/twodb/checkpoints/${id}`,
          commitSha: sha,
          trigger: "manual",
          createdAt: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return c.json(row);
    } catch {
      return c.json({ error: "runner_offline" }, 503);
    }
  })

  .post("/checkpoints/:id/restore", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const cp = await db
      .selectFrom("code_checkpoint")
      .select(["id", "codeDirectoryId", "ref"])
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!cp) return c.json({ error: "checkpoint_not_found" }, 404);

    const dir = await db.selectFrom("code_directory").select(["id", "runnerId", "cwd"]).where("id", "=", cp.codeDirectoryId).executeTakeFirst();
    if (!dir) return c.json({ error: "directory_not_found" }, 404);

    const q = (v: string) => `'${v.replace(/'/g, "'\\''")}'`;
    const script = [`cd ${q(dir.cwd)} 2>/dev/null || exit 9`, `git restore --source=${cp.ref} --staged --worktree . || exit 11`].join("\n");

    try {
      const r = await runnerManager.execOnRunner(dir.runnerId, script, undefined, { waitMs: 0 });
      if (r.code === 9) return c.json({ error: "directory_missing" }, 409);
      if (r.code !== 0) return c.json({ error: "restore_failed", detail: r.stderr.trim().slice(0, 300) }, 500);
      return c.json({ ok: true });
    } catch {
      return c.json({ error: "runner_offline" }, 503);
    }
  })

  .delete("/checkpoints/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const cp = await db
      .selectFrom("code_checkpoint")
      .select(["id", "codeDirectoryId", "ref"])
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!cp) return c.json({ error: "checkpoint_not_found" }, 404);

    const dir = await db.selectFrom("code_directory").select(["id", "runnerId", "cwd"]).where("id", "=", cp.codeDirectoryId).executeTakeFirst();
    if (!dir) return c.json({ error: "directory_not_found" }, 404);

    const q = (v: string) => `'${v.replace(/'/g, "'\\''")}'`;
    const script = [`cd ${q(dir.cwd)} 2>/dev/null || exit 9`, `git update-ref -d ${cp.ref} 2>/dev/null`].join("\n");

    try {
      await runnerManager.execOnRunner(dir.runnerId, script, undefined, { waitMs: 0 });
    } catch {
      return c.json({ error: "runner_offline" }, 503);
    }

    await db.deleteFrom("code_checkpoint").where("id", "=", cp.id).execute();
    return c.json({ ok: true });
  })
  .get("/settings", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    return c.json(await getCodeSettings(s.organizationId));
  })

  .put("/settings", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    if (body?.terminalScope !== undefined && !["runner", "directory", "session"].includes(body.terminalScope)) {
      return c.json({ error: "invalid_terminal_scope" }, 400);
    }
    const patch = body?.terminalScope !== undefined ? { terminalScope: body.terminalScope } : {};
    return c.json(await setCodeSettings(s.organizationId, patch));
  })
  .get("/directories", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const rows = await db.selectFrom("code_directory").selectAll().where("organizationId", "=", s.organizationId).orderBy("createdAt", "asc").execute();
    return c.json(rows);
  })

  .post("/directories", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    if (typeof body?.runnerId !== "string" || !body.runnerId) return c.json({ error: "invalid_runner" }, 400);
    if (typeof body?.cwd !== "string" || !body.cwd.trim()) return c.json({ error: "invalid_cwd" }, 400);

    const runner = await db
      .selectFrom("runner")
      .select("id")
      .where("id", "=", body.runnerId)
      .where("organizationId", "=", s.organizationId)
      .where("deletedAt", "is", null)
      .executeTakeFirst();
    if (!runner) return c.json({ error: "runner_not_found" }, 404);

    // Same runner + path is the same directory — reuse the existing row.
    const existing = await db
      .selectFrom("code_directory")
      .selectAll()
      .where("organizationId", "=", s.organizationId)
      .where("runnerId", "=", runner.id)
      .where("cwd", "=", body.cwd.trim())
      .executeTakeFirst();
    if (existing) return c.json(existing);

    if (typeof body?.displayName !== "string" || !body.displayName.trim()) {
      return c.json({ error: "invalid_display_name" }, 400);
    }

    const now = new Date();
    const row = await db
      .insertInto("code_directory")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        runnerId: runner.id,
        cwd: body.cwd.trim(),
        displayName: body.displayName.trim(),
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row, 201);
  })

  .get("/directories/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db
      .selectFrom("code_directory")
      .selectAll()
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!row) return c.json({ error: "directory_not_found" }, 404);
    return c.json(row);
  })

  .patch("/directories/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const existing = await db
      .selectFrom("code_directory")
      .select("id")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!existing) return c.json({ error: "directory_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{ runnerId: string; cwd: string; displayName: string }> = {};
    if (body?.runnerId !== undefined) {
      if (typeof body.runnerId !== "string" || !body.runnerId) return c.json({ error: "invalid_runner" }, 400);
      const runner = await db
        .selectFrom("runner")
        .select("id")
        .where("id", "=", body.runnerId)
        .where("organizationId", "=", s.organizationId)
        .where("deletedAt", "is", null)
        .executeTakeFirst();
      if (!runner) return c.json({ error: "runner_not_found" }, 404);
      patch.runnerId = runner.id;
    }
    if (body?.cwd !== undefined) {
      if (typeof body.cwd !== "string" || !body.cwd.trim()) return c.json({ error: "invalid_cwd" }, 400);
      patch.cwd = body.cwd.trim();
    }
    if (body?.displayName !== undefined) {
      if (typeof body.displayName !== "string" || !body.displayName.trim()) {
        return c.json({ error: "invalid_display_name" }, 400);
      }
      patch.displayName = body.displayName.trim();
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);

    const row = await db
      .updateTable("code_directory")
      .set({ ...patch, updatedAt: new Date() })
      .where("id", "=", existing.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row);
  })

  .delete("/directories/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db.deleteFrom("code_directory").where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!row) return c.json({ error: "directory_not_found" }, 404);
    return c.json({ ok: true });
  })

  .get("/sessions", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    let query = db.selectFrom("code_session").selectAll().where("organizationId", "=", s.organizationId);

    const type = c.req.query("type");
    if (type === "sub_agent") query = query.where("type", "=", "sub_agent");
    else if (type !== "all") query = query.where("type", "=", "main_agent");

    const parentSessionId = c.req.query("parentSessionId");
    if (parentSessionId) query = query.where("parentSessionId", "=", parentSessionId);

    const codeDirectoryId = c.req.query("codeDirectoryId");
    if (codeDirectoryId) query = query.where("codeDirectoryId", "=", codeDirectoryId);

    const rows = await query.orderBy("updatedAt", "desc").execute();
    return c.json(rows);
  })

  .post("/sessions", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);

    let type: CodeSessionType = "main_agent";
    if (body?.type !== undefined) {
      if (body.type !== "main_agent" && body.type !== "sub_agent") {
        return c.json({ error: "invalid_type" }, 400);
      }
      type = body.type;
    }

    let title = "New chat";
    if (body?.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return c.json({ error: "invalid_title" }, 400);
      }
      title = body.title.trim();
    }

    let parentSessionId: string | null = null;
    if (body?.parentSessionId !== undefined && body.parentSessionId !== null) {
      if (typeof body.parentSessionId !== "string") {
        return c.json({ error: "invalid_parent" }, 400);
      }
      const parent = await db
        .selectFrom("code_session")
        .select("id")
        .where("id", "=", body.parentSessionId)
        .where("organizationId", "=", s.organizationId)
        .executeTakeFirst();
      if (!parent) return c.json({ error: "parent_not_found" }, 404);
      parentSessionId = parent.id;
    }
    if (type === "sub_agent" && !parentSessionId) {
      return c.json({ error: "parent_required" }, 400);
    }
    if (type === "main_agent" && parentSessionId) {
      return c.json({ error: "parent_not_allowed" }, 400);
    }

    let codeDirectoryId: string | null = null;
    if (body?.codeDirectoryId !== undefined && body.codeDirectoryId !== null) {
      if (typeof body.codeDirectoryId !== "string") {
        return c.json({ error: "invalid_directory" }, 400);
      }
      const directory = await db
        .selectFrom("code_directory")
        .select("id")
        .where("id", "=", body.codeDirectoryId)
        .where("organizationId", "=", s.organizationId)
        .executeTakeFirst();
      if (!directory) return c.json({ error: "directory_not_found" }, 404);
      codeDirectoryId = directory.id;
    }

    let agentId: string | null = null;
    if (body?.agentId !== undefined && body.agentId !== null) {
      if (typeof body.agentId !== "string") {
        return c.json({ error: "invalid_agent" }, 400);
      }
      const agent = await db
        .selectFrom("agent")
        .select(["id", "codeDirectoryId"])
        .where("id", "=", body.agentId)
        .where("organizationId", "=", s.organizationId)
        .executeTakeFirst();
      if (!agent) return c.json({ error: "agent_not_found" }, 404);
      if (agent.codeDirectoryId && agent.codeDirectoryId !== codeDirectoryId) {
        return c.json({ error: "agent_scope_mismatch" }, 400);
      }
      agentId = agent.id;
    }

    let mode: CodeSessionMode | null = null;
    if (body?.mode !== undefined && body.mode !== null) {
      const m = body.mode;
      if (typeof m?.type !== "string" || !m.type.trim() || typeof m?.instruction !== "string") {
        return c.json({ error: "invalid_mode" }, 400);
      }
      const commands = m.commands === undefined ? [] : m.commands;
      if (!Array.isArray(commands) || commands.some((cmd) => typeof cmd !== "string")) {
        return c.json({ error: "invalid_mode" }, 400);
      }
      mode = { type: m.type.trim(), instruction: m.instruction, commands };
    }

    const now = new Date();
    const row = await db
      .insertInto("code_session")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        title,
        connectionId: null,
        model: null,
        codeDirectoryId,
        type,
        parentSessionId,
        agentId,
        mode: mode === null ? null : JSON.stringify(mode),
        runtimeState: null,
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row, 201);
  })

  .get("/sessions/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const session = await db
      .selectFrom("code_session")
      .selectAll()
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!session) return c.json({ error: "session_not_found" }, 404);

    const messages = await db.selectFrom("code_session_message").selectAll().where("sessionId", "=", session.id).orderBy("createdAt", "asc").execute();

    const subagents = await db
      .selectFrom("code_session")
      .select(["id", "title", "type", "mode", "createdAt", "updatedAt"])
      .where("parentSessionId", "=", session.id)
      .orderBy("createdAt", "asc")
      .execute();

    const usage = await db
      .selectFrom("code_session_usage_event")
      .select((eb) => [
        eb.fn.sum("inputTokens").as("inputTokens"),
        eb.fn.sum("outputTokens").as("outputTokens"),
        eb.fn.sum("cachedInputTokens").as("cachedTokens"),
      ])
      .where("sessionId", "=", session.id)
      .executeTakeFirst();
    const lastRound = await db
      .selectFrom("code_session_usage_event")
      .select(["inputTokens", "outputTokens"])
      .where("sessionId", "=", session.id)
      .orderBy("createdAt", "desc")
      .limit(1)
      .executeTakeFirst();

    return c.json({
      ...session,
      messages,
      subagents,
      usage: {
        inputTokens: Number(usage?.inputTokens ?? 0),
        outputTokens: Number(usage?.outputTokens ?? 0),
        cachedTokens: Number(usage?.cachedTokens ?? 0),
        contextTokens: lastRound ? lastRound.inputTokens + lastRound.outputTokens : 0,
      },
    });
  })

  .patch("/sessions/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const session = await db
      .selectFrom("code_session")
      .select(["id", "codeDirectoryId"])
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!session) return c.json({ error: "session_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{
      title: string;
      connectionId: string | null;
      model: string | null;
      thinkingLevel: string;
      agentId: string | null;
      codeDirectoryId: string | null;
      mode: string | null;
      runtimeState: string | null;
    }> = {};

    if (body?.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return c.json({ error: "invalid_title" }, 400);
      }
      patch.title = body.title.trim();
    }

    if (body?.connectionId !== undefined) {
      if (body.connectionId === null) {
        patch.connectionId = null;
      } else if (typeof body.connectionId === "string" && body.connectionId) {
        const conn = await db
          .selectFrom("llm_connection")
          .select("id")
          .where("id", "=", body.connectionId)
          .where("organizationId", "=", s.organizationId)
          .executeTakeFirst();
        if (!conn) return c.json({ error: "connection_not_found" }, 404);
        patch.connectionId = body.connectionId;
      }
    }

    if (body?.model !== undefined) {
      patch.model = typeof body.model === "string" && body.model.trim() ? body.model.trim().slice(0, 200) : null;
    }

    if (body?.thinkingLevel !== undefined) {
      if (typeof body.thinkingLevel !== "string" || !["off", "low", "medium", "high"].includes(body.thinkingLevel)) {
        return c.json({ error: "invalid_thinking_level" }, 400);
      }
      patch.thinkingLevel = body.thinkingLevel;
    }
    if (body?.agentId !== undefined) {
      if (body.agentId === null) {
        patch.agentId = null;
      } else {
        if (typeof body.agentId !== "string") {
          return c.json({ error: "invalid_agent" }, 400);
        }
        const agent = await db
          .selectFrom("agent")
          .select(["id", "codeDirectoryId"])
          .where("id", "=", body.agentId)
          .where("organizationId", "=", s.organizationId)
          .executeTakeFirst();
        if (!agent) return c.json({ error: "agent_not_found" }, 404);
        const effectiveDirectoryId = patch.codeDirectoryId !== undefined ? patch.codeDirectoryId : session.codeDirectoryId;
        if (agent.codeDirectoryId && agent.codeDirectoryId !== effectiveDirectoryId) {
          return c.json({ error: "agent_scope_mismatch" }, 400);
        }
        patch.agentId = agent.id;
      }
    }
    if (body?.runtimeState !== undefined) {
      if (body.runtimeState === null) {
        patch.runtimeState = null;
      } else if (typeof body.runtimeState === "object" && !Array.isArray(body.runtimeState)) {
        patch.runtimeState = JSON.stringify(body.runtimeState);
      } else {
        return c.json({ error: "invalid_runtime_state" }, 400);
      }
    }
    if (body?.mode !== undefined) {
      if (body.mode === null) {
        patch.mode = null;
      } else {
        const m = body.mode;
        if (typeof m?.type !== "string" || !m.type.trim() || typeof m?.instruction !== "string") {
          return c.json({ error: "invalid_mode" }, 400);
        }
        const commands = m.commands === undefined ? [] : m.commands;
        if (!Array.isArray(commands) || commands.some((cmd) => typeof cmd !== "string")) {
          return c.json({ error: "invalid_mode" }, 400);
        }
        patch.mode = JSON.stringify({ type: m.type.trim(), instruction: m.instruction, commands });
      }
    }
    if (body?.codeDirectoryId !== undefined) {
      if (body.codeDirectoryId === null) {
        patch.codeDirectoryId = null;
      } else {
        if (typeof body.codeDirectoryId !== "string") {
          return c.json({ error: "invalid_directory" }, 400);
        }
        const directory = await db
          .selectFrom("code_directory")
          .select("id")
          .where("id", "=", body.codeDirectoryId)
          .where("organizationId", "=", s.organizationId)
          .executeTakeFirst();
        if (!directory) return c.json({ error: "directory_not_found" }, 404);
        patch.codeDirectoryId = directory.id;
      }
    }
    if (Object.keys(patch).length === 0) {
      return c.json({ error: "empty_update" }, 400);
    }

    const row = await db
      .updateTable("code_session")
      .set({ ...patch, updatedAt: new Date() })
      .where("id", "=", session.id)
      .returningAll()
      .executeTakeFirst();
    return c.json(row);
  })

  .delete("/sessions/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db
      .deleteFrom("code_session")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .returning("id")
      .executeTakeFirst();
    if (!row) return c.json({ error: "session_not_found" }, 404);
    return c.json({ ok: true });
  });
