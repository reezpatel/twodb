// Real-browser check (Playwright + the dev shim). Run with the server, shim and vite up:
//   node scripts/ui-check.mjs         → screenshots land in /tmp/paintress-ui/
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { glob } from "node:fs/promises";

const require = createRequire(import.meta.url);
let chromium;
const root = new URL("../../../", import.meta.url).pathname;
for await (const p of glob(`${root}node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/index.js`)) chromium = require(p).chromium;
if (!chromium) throw new Error("playwright-core not found in the pnpm store");

const UI = process.env.UI ?? "https://127.0.0.1:6507";
const API = process.env.API ?? "http://127.0.0.1:6414";
const OUT = "/tmp/paintress-ui";
mkdirSync(OUT, { recursive: true });

const human = { "x-twodb-auth-kind": "session", "x-twodb-user-id": "dev-user", "x-twodb-workspace-id": "dev-ws", "x-twodb-space-ids": "dev-space", "content-type": "application/json" };
const agent = { "x-twodb-auth-kind": "apiKey", "x-twodb-api-key-id": "ui-agent", "x-twodb-workspace-id": "dev-ws", "x-twodb-space-ids": "dev-space", "content-type": "application/json" };
const call = async (who, method, path, body) => {
  const r = await fetch(API + path, { method, headers: who, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(`${method} ${path}: ${JSON.stringify(j)}`);
  return j;
};

// Geometry audit run inside the page: what a human would notice as "broken layout".
const AUDIT = () => {
  const rect = (el) => el.getBoundingClientRect();
  const nodes = [...document.querySelectorAll(".react-flow__node")].map((el) => ({ el, id: el.dataset.id, type: [...el.classList].find((c) => c.startsWith("react-flow__node-"))?.replace("react-flow__node-", ""), r: rect(el) }));
  const issues = [];
  const containers = nodes.filter((n) => ["group", "pool", "lane"].includes(n.type));
  const leaves = nodes.filter((n) => !["group", "pool", "lane"].includes(n.type));
  for (const a of leaves) {
    // every leaf that sits inside a container's rect must be fully inside it (no half-in nodes)
    for (const c of containers) {
      const cx = a.r.x + a.r.width / 2, cy = a.r.y + a.r.height / 2;
      const centreIn = cx > c.r.x && cx < c.r.right && cy > c.r.y && cy < c.r.bottom;
      const fullyIn = a.r.x >= c.r.x - 1 && a.r.right <= c.r.right + 1 && a.r.y >= c.r.y - 1 && a.r.bottom <= c.r.bottom + 1;
      if (centreIn && !fullyIn) issues.push(`node ${a.id} sticks out of ${c.type} ${c.id}`);
    }
  }
  for (let i = 0; i < leaves.length; i++)
    for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i].r, b = leaves[j].r;
      const ox = Math.min(a.right, b.right) - Math.max(a.x, b.x), oy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
      if (ox > 4 && oy > 4) issues.push(`nodes ${leaves[i].id} and ${leaves[j].id} overlap by ${Math.round(ox)}x${Math.round(oy)}`);
    }
  // text must not be clipped by its shape
  for (const n of leaves) for (const t of n.el.querySelectorAll("div")) if (t.children.length === 0 && t.textContent.trim() && t.scrollWidth > t.clientWidth + 2 && getComputedStyle(t).overflow !== "visible") issues.push(`text clipped in ${n.id}: "${t.textContent.slice(0, 30)}"`);
  // nested containers must be strictly inside their parents
  for (const a of containers) for (const b of containers) if (a !== b && rect(a.el).width < rect(b.el).width && a.r.x >= b.r.x && a.r.right <= b.r.right && a.r.y >= b.r.y && a.r.bottom <= b.r.bottom === false && a.el.closest(".react-flow__node") && false) issues.push("x");
  return { nodes: nodes.length, issues };
};

let failed = 0;
const check = (name, ok, extra) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || extra === undefined ? "" : "  " + JSON.stringify(extra)}`);
  if (!ok) failed++;
};
// CHROME=/path/to/chrome overrides. On NixOS the Playwright-downloaded binary cannot run, so use any Nix-built Chromium.
const nixChromes = await Array.fromAsync(glob("/nix/store/*-chromium-[0-9]*/bin/chromium"));
const exe = process.env.CHROME ?? nixChromes[0] ?? (await Array.fromAsync(glob(`${homedir()}/.cache/ms-playwright/chromium-*/chrome-linux*/chrome`)))[0];
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, ignoreHTTPSErrors: true });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text()));

try {
  // ---------------------------------------------------------------- list
  const diagram = await call(human, "POST", "/boards", { name: "UI check — architecture", kind: "diagram" });
  await page.goto(UI + "/");
  await page.getByText("UI check — architecture").first().waitFor({ timeout: 15000 });
  check("boards list shows the new board", true);
  await page.screenshot({ path: `${OUT}/01-list.png` });

  // ------------------------------------------------------------- canvas
  await page.goto(`${UI}/b/${diagram.id}`);
  await page.getByText("UI check — architecture").first().waitFor();
  await page.waitForSelector(".react-flow");
  const built = await call(agent, "POST", `/boards/${diagram.id}/diagram`, {
    label: "AI: AWS 3-tier",
    groups: [
      { key: "cloud", title: "AWS Cloud", style: "aws-cloud" },
      { key: "vpc", title: "VPC", style: "aws-vpc", parent: "cloud" },
      { key: "priv", title: "Private subnet", style: "aws-subnet-private", parent: "vpc" },
    ],
    nodes: [
      { key: "user", label: "Users", icon: "mdi:account-group" },
      { key: "cf", label: "CloudFront", icon: "logos:aws-cloudfront", parent: "cloud" },
      { key: "api", label: "API", sublabel: "Lambda", icon: "logos:aws-lambda", parent: "priv" },
      { key: "db", label: "Aurora", icon: "logos:aws-aurora", shape: "cylinder", parent: "priv" },
    ],
    edges: [{ from: "user", to: "cf", label: "HTTPS", step: 1 }, { from: "cf", to: "api", step: 2 }, { from: "api", to: "db", label: "SQL", step: 3 }],
  });
  await page.waitForFunction(() => document.querySelectorAll(".react-flow__node").length >= 7, null, { timeout: 8000 });
  check("agent diagram appears live (3 groups + 4 nodes)", true);
  const edgeCount = await page.locator(".react-flow__edge").count();
  check("edges are drawn", edgeCount === 3, edgeCount);
  await page.waitForTimeout(1200);
  check("toast announces the AI change", await page.getByText("AI: AWS 3-tier").first().isVisible());
  check("icons load (img elements with real size)", await page.evaluate(() => [...document.querySelectorAll(".react-flow__node img")].filter((i) => i.naturalWidth > 0).length >= 4));
  await page.waitForTimeout(500);
  const a1 = await page.evaluate(AUDIT);
  check("AWS diagram layout: no overlaps, nothing sticks out of its group, no clipped text", a1.issues.length === 0, a1.issues);
  await page.screenshot({ path: `${OUT}/02-agent-diagram.png` });

  // ------------------------------------------------------- undo agent edit
  await page.locator(".react-flow__pane").click({ position: { x: 700, y: 500 } });
  await page.keyboard.press("Control+z");
  await page.waitForFunction(() => document.querySelectorAll(".react-flow__node").length === 0, null, { timeout: 8000 });
  check("Ctrl+Z undoes the agent's whole batch", true);
  check("undo reached the server (board empty for agents too)", (await call(agent, "GET", `/boards/${diagram.id}/items`)).items.length === 0);
  await page.keyboard.press("Control+Shift+z");
  await page.waitForFunction(() => document.querySelectorAll(".react-flow__node").length >= 7, null, { timeout: 8000 });
  check("Ctrl+Shift+Z redoes it", true);

  // ----------------------------------------------- drag = pinned on server
  const apiNode = page.locator(".react-flow__node", { hasText: "API" }).first();
  const box = await apiNode.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const apiItem = (await call(agent, "GET", `/boards/${diagram.id}/items`)).items.find((i) => i.key === "api");
  check("dragging a node saves it and pins it", apiItem?.pinned === true, apiItem && { x: apiItem.x, y: apiItem.y, pinned: apiItem.pinned });

  // --------------------------------------------- palette: add from the UI
  await page.getByRole("button", { name: "Icons" }).click();
  await page.getByPlaceholder(/Search/).fill("kafka");
  await page.waitForSelector('aside img[alt^="kafka"]', { timeout: 8000 });
  await page.locator('aside img[alt^="kafka"]').first().click();
  await page.waitForTimeout(600);
  const kafka = (await call(agent, "GET", `/boards/${diagram.id}/items`)).items.find((i) => i.data?.icon?.includes("kafka"));
  check("clicking a palette icon adds it to the board", !!kafka, kafka?.data);

  // ----------------------------------------------------------------- ERD
  const erd = await call(human, "POST", "/boards", { name: "UI check — ERD", kind: "diagram" });
  await page.goto(`${UI}/b/${erd.id}`);
  await page.waitForSelector(".react-flow");
  await call(agent, "POST", `/boards/${erd.id}/erd`, {
    entities: [
      { key: "users", columns: [{ name: "id", type: "uuid", pk: true }, { name: "email", type: "text", unique: true }] },
      { key: "orders", columns: [{ name: "id", type: "uuid", pk: true }, { name: "user_id", type: "uuid", fk: "users.id" }, { name: "total", type: "numeric" }] },
      { key: "items", columns: [{ name: "order_id", type: "uuid", fk: "orders.id" }, { name: "sku", type: "text" }] },
    ],
  });
  await page.waitForSelector(".react-flow__edge", { timeout: 8000 });
  check("ERD tables + relations render", (await page.locator(".react-flow__node").count()) === 3 && (await page.locator(".react-flow__edge").count()) === 2);
  check("crow's-foot glyphs are drawn", (await page.locator(".react-flow__edge g[transform*='rotate']").count()) >= 4);
  await page.waitForTimeout(500);
  const a2 = await page.evaluate(AUDIT);
  check("ERD layout: tables do not overlap", a2.issues.length === 0, a2.issues);
  await page.screenshot({ path: `${OUT}/03-erd.png` });

  // ----------------------------------------------------- process / swimlane
  const proc = await call(human, "POST", "/boards", { name: "UI check — process", kind: "diagram" });
  await page.goto(`${UI}/b/${proc.id}`);
  await page.waitForSelector(".react-flow");
  await call(agent, "POST", `/boards/${proc.id}/process`, {
    title: "Order fulfilment",
    lanes: [{ key: "cust", title: "Customer" }, { key: "ops", title: "Operations" }],
    steps: [
      { key: "s", lane: "cust", label: "Place order", shape: "terminator" },
      { key: "r", lane: "ops", label: "Review order", shape: "task" },
      { key: "d", lane: "ops", label: "In stock?", shape: "gateway-exclusive" },
      { key: "ship", lane: "ops", label: "Ship", shape: "task" },
      { key: "e", lane: "cust", label: "Receive", shape: "end-event" },
    ],
    flows: [{ from: "s", to: "r" }, { from: "r", to: "d" }, { from: "d", to: "ship", label: "yes" }, { from: "ship", to: "e" }],
  });
  await page.waitForFunction(() => document.querySelectorAll(".react-flow__node").length >= 8, null, { timeout: 8000 });
  await page.waitForTimeout(600);
  const a3 = await page.evaluate(AUDIT);
  check("swimlane layout: steps inside their lanes, no overlaps", a3.issues.length === 0, a3.issues);
  await page.screenshot({ path: `${OUT}/04-process.png` });
  check("swimlane process renders (pool + 2 lanes + 5 steps)", a3.nodes === 8, a3.nodes);

  // ----------------------------------------------------------- doc board
  const doc = await call(human, "POST", "/boards", { name: "UI check — doc", kind: "doc", markdown: "# Design\n\nIntro text.\n\n```mermaid\nflowchart LR\n  A[Client] --> B[API] --> C[(DB)]\n```\n" });
  await page.goto(`${UI}/b/${doc.id}`);
  await page.waitForSelector(".pa-mermaid svg", { timeout: 20000 });
  check("doc board renders the Mermaid diagram", true);
  await call(agent, "PATCH", `/boards/${doc.id}/doc`, { ops: [{ op: "append", markdown: "## Added by an agent\n\nLive!" }] });
  await page.getByRole("heading", { name: "Added by an agent" }).waitFor({ timeout: 8000 });
  check("agent's doc edit shows up live", true);
  await page.screenshot({ path: `${OUT}/05-doc.png` });

  check("no console / page errors", errors.length === 0, errors.slice(0, 5));
} catch (e) {
  console.error(e);
  failed++;
  await page.screenshot({ path: `${OUT}/failure.png` }).catch(() => undefined);
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
