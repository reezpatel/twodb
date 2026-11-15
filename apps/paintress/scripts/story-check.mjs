// Render every story in isolation and fail on render errors / console errors.
import { createRequire } from "node:module";
import { glob } from "node:fs/promises";
const require = createRequire(import.meta.url);
let chromium;
const root = new URL("../../../", import.meta.url).pathname;
for await (const p of glob(`${root}node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/index.js`)) chromium = require(p).chromium;
if (!chromium) throw new Error("playwright-core not found");
const CHROME = require("node:child_process").execSync("ls -d /nix/store/*-chromium-[0-9]*/bin/chromium | head -1").toString().trim();

const SB = process.env.SB ?? "http://127.0.0.1:6528";
const index = await fetch(`${SB}/index.json`).then((r) => r.json());
const ids = Object.keys(index.entries).filter((id) => index.entries[id].type === "story");
console.log(`${ids.length} stories`);

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
let failed = 0;
for (const id of ids) {
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 800 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  // Console "Failed to load resource" entries are environmental (icons proxy is
  // down in a sandbox); real crashes surface as pageerrors.
  page.on("console", (m) => m.type() === "error" && !m.text().includes("Failed to load resource") && errors.push(m.text().slice(0, 200)));
  try {
    await page.goto(`${SB}/iframe.html?id=${id}&viewMode=story`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(700);
    const empty = await page.evaluate(() => (document.getElementById("storybook-root")?.children.length ?? 0) === 0 && document.body.innerText.trim() === "");
    const ok = errors.length === 0 && !empty;
    console.log(`${ok ? "PASS" : "FAIL"}  ${id}${ok ? "" : "  " + JSON.stringify({ errors: errors.slice(0, 2), empty }).slice(0, 300)}`);
    if (!ok) failed++;
  } catch (e) {
    console.log(`FAIL  ${id}  ${String(e).slice(0, 150)}`);
    failed++;
  }
  await page.close();
}
await browser.close();
console.log(failed ? `${failed} FAILED` : "all stories render");
process.exit(failed ? 1 : 0);
