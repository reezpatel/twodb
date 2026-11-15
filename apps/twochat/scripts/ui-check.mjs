#!/usr/bin/env node
/**
 * Storybook render check: serves the built twochat storybook statically and
 * renders every story from index.json with chrome-headless-shell (--dump-dom),
 * failing when a story renders empty or logs console errors.
 *
 * Usage: node apps/twochat/scripts/ui-check.mjs [storybook-dist]
 * Finds chrome in: $CHROME, nix playwright-chromium, ~/.cache/ms-playwright.
 */
import { createReadStream } from "node:fs";
import { readFile, stat, glob } from "node:fs/promises";
import { createServer } from "node:http";
import { join, extname } from "node:path";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = process.argv[2] ?? "/tmp/twochat-sb";

const candidates = [
  process.env.CHROME,
  ...(await Array.fromAsync(glob("/nix/store/*-playwright-chromium/chrome-linux64/chrome"))),
  ...(await Array.fromAsync(glob(`${homedir()}/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell`))),
  ...(await Array.fromAsync(glob(`${homedir()}/.cache/ms-playwright/chromium-*/chrome-linux*/chrome`))),
].filter(Boolean);
const exe = candidates[0];
if (!exe) { console.error("no chrome binary found (set CHROME=...)"); process.exit(1); }

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  let p = join(root, decodeURIComponent(url.pathname).replace(/^\/+/, ""));
  try { if ((await stat(p)).isDirectory()) p = join(p, "index.html"); } catch { /* 404 below */ }
  try {
    const data = await readFile(p);
    res.writeHead(200, { "content-type": MIME[extname(p)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    try { await stat(p); res.writeHead(200); createReadStream(p).pipe(res); } catch { res.writeHead(404).end("nf"); } }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const index = JSON.parse(await readFile(join(root, "index.json"), "utf8"));
const stories = Object.values(index.entries).filter((e) => e.type === "story");

let failed = 0;
for (const s of stories) {
  const url = `${base}/iframe.html?viewMode=story&id=${s.id}`;
  try {
    const { stdout, stderr } = await run(exe, [
      "--headless", "--no-sandbox", "--disable-gpu", "--virtual-time-budget=4000", "--dump-dom", url,
    ], { maxBuffer: 32 * 1024 * 1024 });
    const dom = stdout;
    const content = /<div id="storybook-root">/.test(dom) || /id="root"/.test(dom);
    const empty = !content || dom.length < 2000;
    const consoleErrors = stderr.split("\n").filter((l) => /error/i.test(l) && !/GCM|registration|GPU|dbus|fallback/i.test(l)).slice(0, 2);
    if (empty || consoleErrors.length) {
      failed++;
      console.log(`✗ ${s.title} / ${s.name}`);
      for (const e of consoleErrors) console.log(`   ${e.slice(0, 200)}`);
      if (empty && !consoleErrors.length) console.log("   (rendered empty)");
    } else {
      console.log(`✓ ${s.title} / ${s.name}`);
    }
  } catch (e) {
    failed++;
    console.log(`✗ ${s.title} / ${s.name} — chrome failed: ${String(e.message).split("\n")[0]}`);
  }
}

server.close();
console.log(`\n${stories.length - failed}/${stories.length} stories rendered`);
process.exit(failed ? 1 : 0);
