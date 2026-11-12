// Deeper UI walkthrough — run after ui-check.mjs (reuses its "Garden launch plan" page + inline DB).
//   node apps/garden/scripts/ui-deep.mjs     → screenshots in /tmp/garden-ui/deep-*
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { glob } from "node:fs/promises";

const require = createRequire(import.meta.url);
let chromium;
const root = new URL("../../../", import.meta.url).pathname;
for await (const p of glob(`${root}node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/index.js`)) chromium = require(p).chromium;
const UI = process.env.UI ?? "https://127.0.0.1:6509";
const API = "http://127.0.0.1:6498/apps/garden";
const H = { "x-garden-space": "dev-space", "content-type": "application/json" };
const api = async (m, p, b) => (await fetch(API + p, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined })).json();

const nix = await Array.fromAsync(glob("/nix/store/*-chromium-[0-9]*/bin/chromium"));
const exe = process.env.CHROME ?? nix[0] ?? (await Array.fromAsync(glob(`${homedir()}/.cache/ms-playwright/chromium-*/chrome-linux*/chrome`)))[0];
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.request().method()} ${r.url()}`));

let n = 0;
const shot = (name) => page.screenshot({ path: `/tmp/garden-ui/deep-${String(++n).padStart(2, "0")}-${name}.png` });
const results = [];
const step = async (label, fn) => {
  try {
    await fn();
    results.push(`✓ ${label}`);
  } catch (e) {
    results.push(`✗ ${label} — ${e.message.split("\n")[0]}`);
    await shot(`fail-${label.replace(/\W+/g, "-")}`);
  }
};
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

// Elements that spill out of the viewport horizontally = broken layout.
const audit = () =>
  page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll("button, input, a, [role=button]")) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > window.innerWidth + 1 && !el.closest(".overflow-x-auto")) bad.push(`${el.tagName} "${(el.textContent || "").trim().slice(0, 30)}" right=${Math.round(r.right)}`);
    }
    return bad.slice(0, 5);
  });

const clickCell = async (rowText, column) => {
  const row = page.locator(".group\\/row").filter({ hasText: rowText }).first();
  const header = page.locator("button").filter({ hasText: new RegExp(`^${column}$`) }).first();
  const hb = await header.boundingBox();
  const rb = await row.boundingBox();
  await page.mouse.click(hb.x + 40, rb.y + rb.height / 2);
};

const tree = await api("GET", "/tree");
const plan = tree.nodes.find((x) => x.title === "Garden launch plan");
const dbNode = tree.nodes.find((x) => x.kind === "database" && x.parentId === plan?.id);
if (!plan || !dbNode) throw new Error("run ui-check.mjs first");
const DB = dbNode.id;

await step("open database full page + rename", async () => {
  await page.goto(`${UI}/${DB}`, { waitUntil: "networkidle" });
  const title = page.locator("textarea").first();
  await title.fill("Roadmap");
  await title.press("Tab");
  await page.waitForTimeout(700);
  expect((await api("GET", `/records/${DB}`)).title === "Roadmap", "title not saved");
});

await step("table: set status via cell popover", async () => {
  await page.getByRole("button", { name: /^Table$/ }).first().click();
  await page.waitForTimeout(300);
  await clickCell("Design system", "Status");
  await page.locator("[data-radix-popper-content-wrapper]").getByRole("button", { name: "Done" }).click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  const d = await api("GET", `/databases/${DB}`);
  const status = d.fields.find((f) => f.type === "status");
  const rows = await api("POST", `/databases/${DB}/query`, {});
  const v = rows.rows.find((r) => r.title === "Design system").values[status.id];
  expect(status.config.options.find((o) => o.id === v)?.name === "Done", `status is ${v}`);
  await shot("status-set");
});

await step("filter: status is Done", async () => {
  await page.getByTitle("Filter").click();
  await page.getByRole("button", { name: "Add filter" }).click();
  const selects = page.locator("[data-radix-popper-content-wrapper] select");
  await selects.nth(0).selectOption({ label: "Status" });
  await page.waitForTimeout(200);
  await page.locator("[data-radix-popper-content-wrapper]").getByRole("button", { name: "Select…" }).click();
  await page.getByRole("button", { name: "Done" }).last().click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);
  const visible = await page.locator(".group\\/row").count();
  expect(visible === 1, `expected 1 row, saw ${visible}`);
  await shot("filtered");
});

await step("clear filter", async () => {
  const d = await api("GET", `/databases/${DB}`);
  const table = d.views.find((v) => v.type === "table");
  await api("PATCH", `/views/${table.id}`, { config: { ...table.config, filter: null } });
  await page.reload({ waitUntil: "networkidle" });
  expect((await page.locator(".group\\/row").count()) === 2, "rows not back");
});

await step("add date + number + formula properties", async () => {
  await api("POST", `/databases/${DB}/fields`, { name: "Due", type: "date" });
  await api("POST", `/databases/${DB}/fields`, { name: "Points", type: "number" });
  await api("POST", `/databases/${DB}/fields`, { name: "Score", type: "formula", config: { formula: { expression: 'prop("Points") * 2' } } });
  await page.reload({ waitUntil: "networkidle" });
  const row = page.locator(".group\\/row").filter({ hasText: "Block editor" });
  await clickCell("Block editor", "Points");
  await page.keyboard.type("21");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  expect(await row.getByText("42").count(), "formula did not compute 42");
  await shot("formula");
});

for (const [view, check] of [
  ["Gallery", ".grid"],
  ["Calendar", "text=Mon"],
  ["List", "text=Design system"],
]) {
  await step(`${view} view`, async () => {
    await page.getByRole("button", { name: "Add view" }).click();
    await page.getByRole("button", { name: view }).last().click();
    await page.waitForTimeout(800);
    await page.locator(check).first().waitFor({ timeout: 4000 });
    const bad = await audit();
    expect(!bad.length, `overflow: ${bad.join(", ")}`);
    await shot(view.toLowerCase());
  });
}

await step("relation (two-way) + rollup via API, shown in peek", async () => {
  const people = await api("POST", "/databases", { title: "People" });
  const P = people.database.id;
  const ada = await api("POST", "/pages", { parentId: P, title: "Ada" });
  const rel = await api("POST", `/databases/${DB}/fields`, { name: "Owner", type: "relation", config: { relation: { databaseId: P } }, twoWay: true, reverseName: "Projects" });
  const rows = await api("POST", `/databases/${DB}/query`, {});
  await api("PATCH", `/records/${rows.rows[0].id}/values`, { values: { [rel.id]: [ada.id] } });
  await page.goto(`${UI}/${P}?peek=${ada.id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[role=dialog] textarea");
  await page.waitForTimeout(400);
  expect(await page.locator("[role=dialog]").getByText("Projects").count(), "reverse relation not in properties");
  await shot("peek-relation");
  await page.keyboard.press("Escape");
});

await step("@ mention + backlinks", async () => {
  const target = await api("POST", "/pages", { title: "Mention target" });
  await page.goto(`${UI}/${plan.id}`, { waitUntil: "networkidle" });
  await page.locator(".twodb-block-content h1").first().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("See @Mention");
  await page.waitForSelector(".twodb-menu-item");
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  const bl = await api("GET", `/records/${target.id}/backlinks`);
  expect(bl.backlinks.some((b) => b.id === plan.id), "no backlink");
  await page.goto(`${UI}/${target.id}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Backlinks · 1/ }).click();
  await shot("backlinks");
});

await step("bubble menu bold", async () => {
  await page.goto(`${UI}/${plan.id}`, { waitUntil: "networkidle" });
  const h = page.locator(".twodb-block-content h1").first();
  await h.dblclick({ position: { x: 20, y: 14 } }); // on the word, not the empty right half of the block
  await page.waitForSelector(".twodb-bubble-row");
  await shot("bubble");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.waitForTimeout(200);
  expect(await page.locator(".twodb-block-content h1 strong").count(), "not bold");
});

await step("trash + restore from sidebar", async () => {
  const tmp = `Temp ${Date.now() % 100000}`;
  const p = await api("POST", "/pages", { title: tmp });
  await page.goto(`${UI}/all`, { waitUntil: "networkidle" });
  const item = page.locator(".group\\/ti").filter({ hasText: tmp });
  await item.hover();
  await item.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Move to trash" }).click();
  await page.waitForTimeout(500);
  expect(!(await page.locator(".group\\/ti").filter({ hasText: tmp }).count()), "still in sidebar");
  await page.goto(`${UI}/trash`, { waitUntil: "networkidle" });
  await page.locator("div.group").filter({ hasText: tmp }).getByTitle("Restore").click();
  await page.waitForTimeout(600);
  expect((await api("GET", `/records/${p.id}`)).deletedAt === null, "not restored");
});

await step("all docs layout audit", async () => {
  await page.goto(`${UI}/all`, { waitUntil: "networkidle" });
  const bad = await audit();
  expect(!bad.length, `overflow: ${bad.join(", ")}`);
  await shot("all-docs");
});

console.log(results.join("\n"));
console.log(errors.length ? `\nERRORS:\n${[...new Set(errors)].join("\n")}` : "\nno errors");
await browser.close();
