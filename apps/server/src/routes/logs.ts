import fs from "node:fs";
import { Hono } from "hono";
import { auth } from "../auth";
import { logFilePath } from "../lib/logger";

// Server-admin only: tail the structured log file the server writes.

const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 200;

interface LogLine {
  line: number;
  raw: string;
}

function readLines(afterLine: number, limit: number): { lines: LogLine[]; total: number; fileId: string | null } {
  const file = logFilePath();
  let content: string;
  let fileId: string | null = null;
  try {
    // Identity of the file (device + inode + birth time) lets the viewer tell
    // a rotated/recreated file apart from one that merely has no new lines.
    const st = fs.statSync(file);
    fileId = `${st.dev}:${st.ino}:${Math.round(st.birthtimeMs)}`;
    content = fs.readFileSync(file, "utf8");
  } catch {
    return { lines: [], total: 0, fileId };
  }
  const all = content.split("\n");
  // Trailing newline produces one empty tail entry — drop it only if empty.
  if (all.length && all[all.length - 1] === "") all.pop();
  const total = all.length;

  // afterLine=N returns lines N+1.. (1-based line numbers); omit/0 returns the tail.
  const start = afterLine > 0 ? afterLine : Math.max(0, total - limit);
  const slice = all.slice(start, start + limit);
  const lines = slice
    .map((raw, i) => ({ line: start + i + 1, raw: raw.trim() === "" ? "" : raw }))
    .filter((l) => l.raw !== "");
  return { lines, total, fileId };
}

export const logsRoutes = new Hono()
  .use("*", async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session || session.user.role !== "admin") {
      return c.json({ error: "forbidden" }, 403);
    }
    await next();
  })

  .get("/", async (c) => {
    const afterLine = Number(c.req.query("afterLine") ?? 0);
    const limit = Math.min(Number(c.req.query("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, MAX_LIMIT);
    if (!Number.isFinite(afterLine) || afterLine < 0 || !Number.isFinite(limit) || limit < 1) {
      return c.json({ error: "invalid_query" }, 400);
    }
    const { lines, total, fileId } = readLines(afterLine, limit);
    c.header("cache-control", "no-store");
    return c.json({ lines, total, fileId, file: logFilePath() });
  });
