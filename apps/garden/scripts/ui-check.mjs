// Real-browser walkthrough (Playwright + dev shim). With server, shim and vite up:
//   node apps/garden/scripts/ui-check.mjs        → screenshots in /tmp/garden-ui/
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { glob } from "node:fs/promises";

const require = createRequire(import.meta.url);
let chromium;
const root = new URL("../../../", import.meta.url).pathname;
for await (const p of glob(`${root}node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/index.js`)) chromium = require(p).chromium;
if (!chromium) throw new Error("playwright-core not found in the pnpm store");

const UI = process.env.UI ?? "https://127.0.0.1:6509";
const OUT = "/tmp/garden-ui";
mkdirSync(OUT, { recursive: true });
// On NixOS the Playwright-downloaded binary cannot run, so prefer any Nix-built Chromium.
const nixChromes = await Array.fromAsync(glob("/nix/store/*-chromium-[0-9]*/bin/chromium"));
const exe = process.env.CHROME ?? nixChromes[0] ?? (await Array.fromAsync(glob(`${homedir()}/.cache/ms-playwright/chromium-*/chrome-linux*/chrome`)))[0];
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.request().method()} ${r.url()}`));

let n = 0;
const shot = async (name) => {
  const file = `${OUT}/${String(++n).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file });
  console.log("shot", file);
};
const step = async (label, fn) => {
  try {
    await fn();
    console.log("✓", label);
  } catch (e) {
    console.log("✗", label, e.message.split("\n")[0]);
    await shot(`fail-${label.replace(/\W+/g, "-")}`);
  }
};

const mode = process.argv[2] ?? "full";
await page.goto(UI + "/all", { waitUntil: "networkidle" });
await shot("all-docs");
if (mode === "quick") {
  console.log(errors.length ? errors.join("\n") : "no errors");
  await browser.close();
  process.exit(0);
}

// 1. New doc, title, editor typing, slash menu
await step("new doc", async () => {
  await page.getByRole("button", { name: "New doc" }).click();
  await page.waitForURL(/\/[0-9a-f-]{36}$/);
  await page.waitForSelector(".twodb-block-content");
  await page.keyboard.type("Garden launch plan"); // title is auto-focused on new pages
  await page.keyboard.press("Enter");
  await page.keyboard.type("This is the plan for our ");
  await page.keyboard.type("knowledge garden.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/head");
  await page.waitForSelector(".twodb-menu");
  await shot("slash-menu");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Goals");
  await page.keyboard.press("Enter");
  await page.keyboard.type("[] Ship the editor");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Ship databases");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
});

// 2. Inline database via slash
await step("inline database", async () => {
  await page.keyboard.type("/database");
  await page.waitForSelector(".twodb-menu");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".twodb-database-block .garden-database", { timeout: 8000 });
  await page.waitForTimeout(600);
  await shot("inline-database");
});

// 3. Add rows + a status property in the inline table
await step("rows + status", async () => {
  const block = page.locator(".twodb-database-block");
  for (const title of ["Design system", "Block editor"]) {
    await block.getByRole("button", { name: "New page" }).first().click();
    await block.locator("input:focus").waitFor({ timeout: 5000 });
    await page.keyboard.type(title);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(400);
  await block.getByRole("button", { name: "Add property" }).click();
  await page.getByRole("button", { name: "Status" }).last().click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  await shot("table-with-status");
});

// 4. Kanban view
await step("kanban view", async () => {
  const block = page.locator(".twodb-database-block");
  await block.getByRole("button", { name: "Add view" }).click();
  await page.getByRole("button", { name: "Kanban" }).last().click();
  await page.waitForTimeout(900);
  await shot("kanban");
});

// 5. Peek a row
await step("peek row", async () => {
  await page.locator(".twodb-database-block [role=button]").filter({ hasText: "Design system" }).first().click();
  await page.waitForSelector("[role=dialog] textarea", { timeout: 6000 });
  await page.waitForTimeout(500);
  await shot("peek");
  await page.keyboard.press("Escape");
});

// 6. Quick search
await step("quick search", async () => {
  await page.keyboard.press("Control+k");
  await page.keyboard.type("garden");
  await page.waitForTimeout(600);
  await shot("quick-search");
  await page.keyboard.press("Escape");
});

// 7. All docs + table view of default db
await step("all docs", async () => {
  await page.goto(UI + "/all", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await shot("all-docs-after");
});

console.log(errors.length ? `\nERRORS:\n${[...new Set(errors)].join("\n")}` : "\nno errors");
await browser.close();
