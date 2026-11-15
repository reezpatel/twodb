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
  const nodes = [...document.querySelectorAll("g[data-item]")].map((el) => ({ el, id: el.dataset.item, type: el.dataset.type, r: rect(el) }));
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
  for (const n of leaves) for (const t of n.el.querySelectorAll("foreignObject div")) if (t.children.length === 0 && t.textContent.trim() && t.scrollWidth > t.clientWidth + 2 && getComputedStyle(t).overflow !== "visible") issues.push(`text clipped in ${n.id}: "${t.textContent.slice(0, 30)}"`);
  // nested containers must be strictly inside their parents
  for (const a of containers) for (const b of containers) if (a !== b && rect(a.el).width < rect(b.el).width && a.r.x >= b.r.x && a.r.right <= b.r.right && a.r.y >= b.r.y && a.r.bottom <= b.r.bottom === false && a.el.closest("g[data-item]") && false) issues.push("x");
  return { nodes: nodes.length, issues };
};

let failed = 0;
// Poll until fn() is truthy (server-side state lags optimistic UI by a beat).
const until = async (fn, ms = 10000) => {
  const t0 = Date.now();
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    if (Date.now() - t0 > ms) return null;
    await new Promise((r) => setTimeout(r, 250));
  }
};
const check = (name, ok, extra) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || extra === undefined ? "" : "  " + JSON.stringify(extra)}`);
  if (!ok) failed++;
};
// CHROME=/path/to/chrome overrides. On NixOS the Playwright-downloaded binary cannot run, so use any Nix-built Chromium.
const nixChromes = await Array.fromAsync(glob("/nix/store/*-chromium-[0-9]*/bin/chromium"));
const exe = process.env.CHROME ?? nixChromes[0] ?? (await Array.fromAsync(glob(`${homedir()}/.cache/ms-playwright/chromium-*/chrome-linux*/chrome`)))[0];
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, ignoreHTTPSErrors: true });
// The scaffold's TwoDbAuthProvider wants a Bearer token in localStorage; the dev shim accepts any.
await page.addInitScript(() => {
  try {
    localStorage.setItem("twodb.auth", JSON.stringify({ token: "dev-token", expiresAt: new Date(Date.now() + 864e5).toISOString() }));
  } catch { /* ignore */ }
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text()));

try {
  // ------------------------------------------------------------- shell
  const diagram = await call(human, "POST", "/boards", { name: "UI check — architecture", kind: "diagram" });
  const shellDoc = await call(human, "POST", "/boards", { name: "UI check — shell doc", kind: "doc" });
  await page.goto(UI + "/");
  const sidebar = page.locator("div").filter({ has: page.locator('[role="tablist"]') }).first();
  await page.getByRole("tab", { name: "Diagrams" }).waitFor({ timeout: 15000 });
  await page.getByText("UI check — architecture").first().waitFor();
  check("sidebar shows the diagram board under Diagrams", true);
  check("shell doc is not listed under Diagrams", (await page.getByText("UI check — shell doc").count()) === 0);
  await page.getByRole("tab", { name: "Docs" }).click();
  await page.getByText("UI check — shell doc").first().waitFor();
  check("Docs tab lists the markdown board", true);
  check("diagram board is not listed under Docs", (await page.getByText("UI check — architecture").count()) === 0);

  // rename from the sidebar's hover menu
  const row = page.locator("div.group", { hasText: "UI check — shell doc" }).first();
  await row.hover();
  await row.getByRole("button", { name: "Board options" }).click();
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Board name").fill("UI check — renamed doc");
  await page.keyboard.press("Enter");
  await page.getByText("UI check — renamed doc").first().waitFor();
  check("sidebar rename works", (await call(human, "GET", "/boards")).boards.some((b) => b.name === "UI check — renamed doc"));

  // open from the sidebar, then delete it
  await page.getByText("UI check — renamed doc").first().click();
  await page.waitForURL(`**/b/${shellDoc.id}`);
  check("clicking a sidebar row opens the board", await page.getByRole("tab", { name: "Docs" }).getAttribute("aria-selected") === "true");
  const openRow = page.locator("div.group", { hasText: "UI check — renamed doc" }).first();
  await openRow.hover();
  await openRow.getByRole("button", { name: "Board options" }).click();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await page.waitForURL("**/");
  check("sidebar delete works and navigates home", !(await call(human, "GET", "/boards")).boards.some((b) => b.id === shellDoc.id));
  await page.screenshot({ path: `${OUT}/01-shell.png` });
  await page.getByRole("tab", { name: "Diagrams" }).click();

  // ------------------------------------------------------- grouped sidebar
  const RUN = Date.now().toString(36);
  const GROUP = `Infra ${RUN}`;
  await call(human, "POST", "/boards", { name: `UI check — grouped ${RUN}`, kind: "diagram", groupName: GROUP, spaceId: "dev-space" });
  await page.getByText(`UI check — grouped ${RUN}`).first().waitFor({ timeout: 15000 });
  check("group headers render (General + the new group)", (await page.getByText("General", { exact: true }).count()) >= 1 && (await page.getByText(GROUP, { exact: true }).count()) === 1);
  await page.getByRole("button", { name: GROUP }).click(); // collapse
  await page.waitForTimeout(300);
  check("collapsing a group hides its boards", (await page.getByText(`UI check — grouped ${RUN}`).count()) === 0);
  await page.getByRole("button", { name: GROUP }).click(); // expand (re-resolve after re-render)
  await page.getByText(`UI check — grouped ${RUN}`).waitFor();
  check("expanding shows them again", true);

  // create a board through the dialog, into a brand-new group
  await page.getByRole("button", { name: "New diagram board" }).click();
  await page.getByLabel("Name").fill(`UI check — dialog board ${RUN}`);
  await page.getByLabel("Group").selectOption("__new__");
  await page.getByLabel("New group name").fill(`UI Group ${RUN}`);
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL("**/b/**", { timeout: 10000 });
  await page.getByTitle(`UI Group ${RUN} · Dev space`).waitFor();
  check("dialog creates a board into a new group", true);
  await page.getByRole("button", { name: "Hide sidebar" }).waitFor();
  check("new board opened with the sidebar toggle in the header", true);
  check("no back button in the header", (await page.getByRole("link", { name: "All boards" }).count()) === 0);
  await page.getByRole("button", { name: "Hide sidebar" }).click();
  check("sidebar toggle hides the sidebar", (await page.getByRole("tab", { name: "Diagrams" }).count()) === 0);
  await page.getByRole("button", { name: "Show sidebar" }).click();
  await page.getByRole("tab", { name: "Diagrams" }).waitFor();
  check("and shows it again", true);
  await page.goto(UI + "/");

  // ------------------------------------------------------------- canvas
  await page.goto(`${UI}/b/${diagram.id}`);
  await page.getByText("UI check — architecture").first().waitFor();
  await page.waitForSelector("svg[aria-label='Diagram canvas']");
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
  await page.waitForFunction(() => document.querySelectorAll("g[data-item]").length >= 7, null, { timeout: 8000 });
  check("agent diagram appears live (3 groups + 4 nodes)", true);
  const edgeCount = await page.locator("g[data-edge]").count();
  check("edges are drawn", edgeCount === 3, edgeCount);
  await page.waitForTimeout(1200);
  check("toast announces the AI change", await page.getByText("AI: AWS 3-tier").first().isVisible());
  check("icons load (svg <image> elements present)", await page.evaluate(() => document.querySelectorAll("g[data-item] image").length >= 4));
  await page.waitForTimeout(500);
  const a1 = await page.evaluate(AUDIT);
  check("AWS diagram layout: no overlaps, nothing sticks out of its group, no clipped text", a1.issues.length === 0, a1.issues);
  await page.screenshot({ path: `${OUT}/02-agent-diagram.png` });

  // ------------------------------------------------------- undo agent edit
  await page.locator("svg[aria-label='Diagram canvas']").click({ position: { x: 700, y: 500 } });
  await page.keyboard.press("Control+z");
  await page.waitForFunction(() => document.querySelectorAll("g[data-item]").length === 0, null, { timeout: 8000 });
  check("Ctrl+Z undoes the agent's whole batch", true);
  check("undo reached the server (board empty for agents too)", !!(await until(async () => (await call(agent, "GET", `/boards/${diagram.id}/items`)).items.length === 0)));
  // Wait until the undo's server round-trip has pushed the redo entry (button enables).
  await page.waitForSelector('button[title^="Redo"]:not([disabled])', { timeout: 10000 });
  await page.keyboard.press("Control+Shift+z");
  // Redo replays the creates through the server (ELK re-layout) — allow it time.
  const serverBack = await until(async () => (await call(agent, "GET", `/boards/${diagram.id}/items`)).items.length >= 7, 20000);
  check("redo reached the server", !!serverBack);
  await page.waitForFunction(() => document.querySelectorAll("g[data-item]").length >= 7, null, { timeout: 20000 });
  check("Ctrl+Shift+Z redoes it", true);

  // ----------------------------------------------- drag = pinned on server
  const apiNode = page.locator("g[data-item]", { hasText: "API" }).first();
  const box = await apiNode.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const apiItem = (await call(agent, "GET", `/boards/${diagram.id}/items`)).items.find((i) => i.key === "api");
  check("dragging a node saves it and pins it", apiItem?.pinned === true, apiItem && { x: apiItem.x, y: apiItem.y, pinned: apiItem.pinned });

  // selection: grips must sit at the node's corners (they used to render at the canvas origin)
  await page.locator("g[data-item]", { hasText: "API" }).first().click();
  await page.waitForTimeout(200);
  const grips = await page.evaluate(() => {
    const sel = [...document.querySelectorAll("g[data-item]")].find((g) => g.querySelector(".pa-select-ring"));
    const grip = document.querySelector("g.pa-svg-resize rect");
    if (!grip || !sel) return null;
    const g = grip.getBoundingClientRect();
    const n = sel.getBoundingClientRect();
    // nw grip should be within a few px of the node's top-left corner
    return { dx: Math.abs(g.x + g.width / 2 - n.x), dy: Math.abs(g.y + g.height / 2 - n.y) };
  });
  check("resize grips sit at the selected node's corners", !!grips && grips.dx < 4 && grips.dy < 4, grips);
  await page.keyboard.press("Escape");

  // inline edit: the textarea must open where the label renders (centre of the shape), not at the top edge
  await page.locator("g[data-item]", { hasText: "API" }).first().dblclick();
  await page.waitForSelector("g[data-item] textarea");
  const editPos = await page.evaluate(() => {
    const ta = document.querySelector("g[data-item] textarea");
    const node = ta.closest("g[data-item]");
    const t = ta.getBoundingClientRect();
    const n = node.getBoundingClientRect();
    return { dy: Math.abs(t.y + t.height / 2 - (n.y + n.height / 2)), dx: Math.abs(t.x + t.width / 2 - (n.x + n.width / 2)) };
  });
  check("inline editor is centred on the shape's label", !!editPos && editPos.dy < 6 && editPos.dx < 10, editPos);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // --------------------------------------------- dock: arm, then drag to size
  check("tool dock is visible", await page.locator(".pa-dock").isVisible());
  await page.getByRole("button", { name: /Stickers/ }).click();
  await page.getByPlaceholder(/Search/).fill("kafka");
  await page.waitForSelector('.pa-flyout img[alt^="kafka"]', { timeout: 8000 });
  await page.locator('.pa-flyout img[alt^="kafka"]').first().click();
  await page.getByText("Drag on the canvas to size it").first().waitFor();
  check("clicking a palette icon arms it (hint shows, nothing created yet)", !(await call(agent, "GET", `/boards/${diagram.id}/items`)).items.some((i) => i.data?.icon?.includes("kafka")));
  const pane = page.locator("svg[aria-label='Diagram canvas']");
  const paneBox0 = await pane.boundingBox();
  await page.mouse.move(paneBox0.x + paneBox0.width / 2 - 200, paneBox0.y + paneBox0.height / 2 - 120);
  await page.waitForTimeout(200);
  const preview = await page.evaluate(() => {
    const g = document.querySelector("g.pa-svg-preview");
    return g ? { img: g.querySelectorAll("image").length, w: Number(g.dataset.w), h: Number(g.dataset.h) } : null;
  });
  check("armed item shows a live preview ghost (icon card at cursor)", !!preview && preview.img === 1 && preview.w === 120, preview);
  const paneBox = await pane.boundingBox();
  if (!paneBox) throw new Error("no pane");
  const cx = paneBox.x + paneBox.width / 2;
  const cy = paneBox.y + paneBox.height / 2;
  await page.mouse.move(cx - 100, cy - 70);
  await page.mouse.down();
  await page.mouse.move(cx - 30, cy - 20, { steps: 3 });
  const ghostVisible = await page.locator("rect.pa-svg-create").isVisible().catch(() => false);
  await page.mouse.move(cx + 120, cy + 80, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const kafka = (await call(agent, "GET", `/boards/${diagram.id}/items`)).items.find((i) => i.data?.icon?.includes("kafka"));
  check("ghost rubber band shows while dragging", ghostVisible);
  check("dragging creates the icon card", !!kafka, kafka?.data);
  const zoom = await page.evaluate(() => Number(/scale\(([\d.]+)\)/.exec(document.querySelector("svg[aria-label='Diagram canvas'] > g").getAttribute("transform"))?.[1] ?? 1));
  check(
    "it takes the dragged size (screen drag ÷ zoom)",
    !!kafka && Math.abs(kafka.width - 220 / zoom) < 24 && Math.abs(kafka.height - 150 / zoom) < 24,
    kafka && { w: kafka.width, h: kafka.height, expected: `${Math.round(220 / zoom)}x${Math.round(150 / zoom)}` },
  );

  // arming again + Esc cancels without creating anything
  await page.getByRole("button", { name: /Stickers/ }).click();
  await page.getByPlaceholder(/Search/).fill("kafka");
  await page.waitForSelector('.pa-flyout img[alt^="kafka"]', { timeout: 8000 });
  await page.locator('.pa-flyout img[alt^="kafka"]').first().click();
  await page.getByText("Drag on the canvas to size it").first().waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await pane.click({ position: { x: paneBox.width / 2, y: paneBox.height - 100 } }); // bottom-centre: clear of palette, toolbar, minimap and inspector
  await page.waitForTimeout(400);
  const kafkas = (await call(agent, "GET", `/boards/${diagram.id}/items`)).items.filter((i) => i.data?.icon?.includes("kafka"));
  check("Esc disarms (click afterwards creates nothing)", kafkas.length === 1);

  // --------------------------------------------- dock: notes, shapes, pen, eraser
  await page.getByRole("button", { name: "Sticky notes" }).click();
  check("notes flyout offers colors", (await page.locator(".pa-flyout button").count()) >= 6);
  await page.getByRole("button", { name: "Pink note" }).click();
  check("picking a color arms the note", await page.getByText("Drag on the canvas to size it").first().isVisible());
  await pane.click({ position: { x: paneBox.width / 2 + 220, y: paneBox.height - 100 } }); // bottom-centre-right: clear of dock, toolbar, minimap, inspector
  await page.waitForTimeout(500);
  const pink = (await call(agent, "GET", `/boards/${diagram.id}/items`)).items.find((i) => i.type === "sticky" && i.data?.color === "#fbcfe8");
  check("placed note took the picked color", !!pink);

  await page.getByRole("button", { name: "Shapes", exact: true }).click();
  const shapesFlyout = page.locator('.pa-flyout [role="button"], .pa-flyout button');
  check("shapes flyout hides the quick square/circle", !(await page.locator(".pa-flyout button", { hasText: "Rectangle" }).count()) && !(await page.locator(".pa-flyout button", { hasText: "Ellipse" }).count()));
  await page.keyboard.press("Escape");
  await page.locator("body").click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});

  // pen draws a stroke; eraser removes it
  await page.getByRole("button", { name: /Draw —/ }).click();
  await page.getByRole("button", { name: "Pen", exact: true }).click();
  const sx0 = paneBox.x + paneBox.width / 2 - 320;
  const sy0 = paneBox.y + paneBox.height - 300;
  await page.mouse.move(sx0, sy0);
  await page.mouse.down();
  await page.mouse.move(sx0 + 60, sy0 + 30, { steps: 6 });
  await page.mouse.move(sx0 + 140, sy0 + 10, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const drawItems = (await call(agent, "GET", `/boards/${diagram.id}/items`)).items.filter((i) => i.type === "draw");
  check("pen stroke becomes a draw item", drawItems.length === 1 && (drawItems[0].data?.points?.length ?? 0) >= 6, drawItems[0]?.data);
  check("stroke renders as an svg path", await page.locator("g[data-type='draw'] path").first().isVisible());

  await page.getByRole("button", { name: /Draw —/ }).click();
  await page.getByRole("button", { name: "Eraser", exact: true }).click();
  await page.mouse.move(sx0 + 60, sy0 + 30);
  await page.mouse.down();
  await page.mouse.move(sx0 + 80, sy0 + 28, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const afterErase = (await call(agent, "GET", `/boards/${diagram.id}/items`)).items.filter((i) => i.type === "draw");
  check("eraser removes the stroke", afterErase.length === 0, afterErase.length);
  await page.keyboard.press("Escape"); // back to select tool

  // pointer/hand toggle on a single button
  const toggle = page.getByRole("button", { name: /Select \(V\)/ });
  await toggle.click();
  check("toggle switches to hand", await page.getByRole("button", { name: /Hand tool/ }).isVisible());
  await page.getByRole("button", { name: /Hand tool/ }).click();
  check("and back to select", await page.getByRole("button", { name: /Select \(V\)/ }).isVisible());

  // ----------------------------------------------------------------- ERD
  const erd = await call(human, "POST", "/boards", { name: "UI check — ERD", kind: "diagram" });
  await page.goto(`${UI}/b/${erd.id}`);
  await page.waitForSelector("svg[aria-label='Diagram canvas']");
  await call(agent, "POST", `/boards/${erd.id}/erd`, {
    entities: [
      { key: "users", columns: [{ name: "id", type: "uuid", pk: true }, { name: "email", type: "text", unique: true }] },
      { key: "orders", columns: [{ name: "id", type: "uuid", pk: true }, { name: "user_id", type: "uuid", fk: "users.id" }, { name: "total", type: "numeric" }] },
      { key: "items", columns: [{ name: "order_id", type: "uuid", fk: "orders.id" }, { name: "sku", type: "text" }] },
    ],
  });
  await page.waitForSelector("g[data-edge]", { timeout: 8000 });
  check("ERD tables + relations render", (await page.locator("g[data-item]").count()) === 3 && (await page.locator("g[data-edge]").count()) === 2);
  check("crow's-foot glyphs are drawn", await page.evaluate(() => [...document.querySelectorAll("g[data-edge] circle")].length + [...document.querySelectorAll("g[data-edge] line")].length >= 4));
  await page.waitForTimeout(500);
  const a2 = await page.evaluate(AUDIT);
  check("ERD layout: tables do not overlap", a2.issues.length === 0, a2.issues);
  await page.screenshot({ path: `${OUT}/03-erd.png` });

  // ----------------------------------------------------- process / swimlane
  const proc = await call(human, "POST", "/boards", { name: "UI check — process", kind: "diagram" });
  await page.goto(`${UI}/b/${proc.id}`);
  await page.waitForSelector("svg[aria-label='Diagram canvas']");
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
  await page.waitForFunction(() => document.querySelectorAll("g[data-item]").length >= 8, null, { timeout: 8000 });
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

  // ------------------------------------------------------------- dark mode
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(`${UI}/b/${erd.id}`);
  await page.waitForSelector("g[data-item]");
  await page.waitForTimeout(400);
  const darkAudit = await page.evaluate(() => {
    const rgb = (el) => {
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [255, 255, 255];
      return { r: m[0], g: m[1], b: m[2] };
    };
    const canvasBg = rgb(document.querySelector("svg[aria-label='Diagram canvas']").parentElement);
    const entityBody = document.querySelector("g[data-type='entity'] rect");
    const cardBg = entityBody ? getComputedStyle(entityBody).fill : null;
    const rowText = document.querySelector("g[data-type='entity'] g[data-col] text");
    const rowColor = rowText ? getComputedStyle(rowText).fill : null;
    const edgePath = document.querySelector("g[data-edge] path[stroke]:not([stroke='transparent'])");
    const edgeStroke = edgePath ? getComputedStyle(edgePath).stroke : null;
    return { canvasBg, cardBg, rowColor, edgeStroke };
  });
  check("dark: canvas background is dark", darkAudit.canvasBg.r < 70 && darkAudit.canvasBg.g < 70 && darkAudit.canvasBg.b < 70, darkAudit.canvasBg);
  check("dark: entity card is not white", !!darkAudit.cardBg && Number(darkAudit.cardBg.match(/[\d.]+/g)[0]) < 100, darkAudit.cardBg);
  check("dark: table text is light", !!darkAudit.rowColor && Number(darkAudit.rowColor.match(/[\d.]+/g)[0]) > 150, darkAudit.rowColor);
  check("dark: edge stroke is visible (light)", !!darkAudit.edgeStroke && Number(darkAudit.edgeStroke.match(/[\d.]+/g)[0]) > 100, darkAudit.edgeStroke);
  await page.screenshot({ path: `${OUT}/06-dark-erd.png` });

  await page.goto(`${UI}/b/${diagram.id}`);
  await page.waitForSelector("g[data-item]");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/07-dark-aws.png` });
  const groupStroke = await page.evaluate(() => {
    const g = document.querySelector("g[data-type='group'] rect");
    return g ? getComputedStyle(g).stroke : null;
  });
  const strokeNums = groupStroke?.match(/[\d.]+/g)?.map(Number) ?? [0];
  const strokeRed = groupStroke?.startsWith("color(") ? strokeNums[0] * 255 : strokeNums[0]; // color(srgb r g b) vs rgb(r, g, b)
  check("dark: AWS group border is lifted from near-black", !!groupStroke && strokeRed > 60, groupStroke);

  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForTimeout(300);
  const lightBg = await page.evaluate(() => getComputedStyle(document.querySelector("svg[aria-label='Diagram canvas']").parentElement).backgroundColor);
  check("flips back to light", Number(lightBg.match(/[\d.]+/g)[0]) > 200, lightBg);

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
