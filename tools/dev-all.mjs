#!/usr/bin/env node
// Start every project that has a `dev` script, each as its own moon process.
// A crash in one app never stops the others; crashed apps restart with backoff.
//   node tools/dev-all.mjs [--no-restart] [filter-substring ...]
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
const restart = !args.includes("--no-restart");
const filters = args.filter((a) => !a.startsWith("--"));

// moon project id -> dir, parsed from .moon/workspace.yml
const ws = readFileSync(".moon/workspace.yml", "utf8");
const projects = [...ws.matchAll(/^\s+([\w-]+):\s*"(apps\/[^"]+)"/gm)].map((m) => ({ id: m[1], dir: m[2] }));

const targets = projects.filter(({ id, dir }) => {
  const pj = `${dir}/package.json`;
  if (!existsSync(pj) || !JSON.parse(readFileSync(pj, "utf8")).scripts?.dev) return false;
  return !filters.length || filters.some((f) => id.includes(f));
});

const colors = [36, 33, 35, 32, 34, 91, 96, 93, 95, 92];
const pad = Math.max(...targets.map((t) => t.id.length));
const children = new Map();
let stopping = false;

function start(t, i, attempt = 0) {
  const color = colors[i % colors.length];
  const tag = `\x1b[${color}m${t.id.padEnd(pad)} |\x1b[0m `;
  const started = Date.now();
  const child = spawn("pnpm", ["moon", "run", `${t.id}:dev`], { stdio: ["ignore", "pipe", "pipe"], detached: true });
  children.set(t.id, child);
  const out = (buf) => buf.toString().split("\n").filter(Boolean).forEach((l) => console.log(tag + l));
  child.stdout.on("data", out);
  child.stderr.on("data", out);
  child.on("exit", (code) => {
    if (stopping) return;
    console.log(`${tag}\x1b[31mexited (${code})\x1b[0m`);
    if (!restart) return;
    const next = Date.now() - started > 30_000 ? 0 : attempt + 1; // stable run resets backoff
    const delay = Math.min(2000 * 2 ** next, 60_000);
    console.log(`${tag}restarting in ${delay / 1000}s`);
    setTimeout(() => !stopping && start(t, i, next), delay);
  });
}

console.log(`starting ${targets.length} apps: ${targets.map((t) => t.id).join(", ")}`);
targets.forEach((t, i) => start(t, i));

const stop = () => {
  stopping = true;
  for (const c of children.values()) try { process.kill(-c.pid, "SIGTERM"); } catch {}
  setTimeout(() => process.exit(0), 500);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
