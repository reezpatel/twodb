#!/usr/bin/env tsx
/**
 * End-to-end API smoke test against a running Garden behind the dev shim.
 *   pnpm --filter @twodb/app-garden smoke     (BASE defaults to http://127.0.0.1:6498/apps/garden)
 */
const BASE = process.env.BASE ?? "http://127.0.0.1:6498/apps/garden";
const SPACE = process.env.SPACE ?? "dev-space";

async function call<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", "x-garden-space": SPACE },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : (undefined as T);
}

let passed = 0;
function check(cond: unknown, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  passed++;
  console.log(`  ✓ ${label}`);
}

async function main() {
  const t = await call("GET", "/tree");
  check(t.defaultDatabaseId, "tree returns default Notes database");

  // --- pages + nesting + links ---------------------------------------------
  const parent = await call("POST", "/pages", { title: "Smoke parent" });
  check(parent.databaseId === t.defaultDatabaseId, "free page lives in the default database");
  check(parent.fields.some((f: any) => f.name === "Tags"), "page exposes its database fields (Tags)");
  const child = await call("POST", "/pages", { parentId: parent.id, title: "Smoke child" });
  check(child.ancestors.at(-1).id === parent.id, "child page has ancestors");
  await call("PATCH", `/records/${child.id}`, {
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "zebra-unicorn mentions " }, { type: "pageMention", attrs: { id: parent.id, title: "Smoke parent" } }] }] },
  });
  const bl = await call("GET", `/records/${parent.id}/backlinks`);
  check(bl.backlinks.some((b: any) => b.id === child.id), "backlinks from pageMention");
  const hits = await call("GET", `/search?q=zebra-unicorn`);
  check(hits.hits.some((h: any) => h.id === child.id), "full-text search finds content");

  // --- databases ---------------------------------------------------------------
  const projects = await call("POST", "/databases", { parentId: parent.id, title: "Projects" });
  const tasks = await call("POST", "/databases", { parentId: parent.id, title: "Tasks", inline: true });
  const P = projects.database.id;
  const T = tasks.database.id;
  check(projects.views.length === 1 && projects.fields.some((f: any) => f.id === "title"), "database has a view and system fields");

  const status = await call("POST", `/databases/${T}/fields`, { name: "Status", type: "status" });
  check(status.config.options.length === 3, "status gets default options");
  const est = await call("POST", `/databases/${T}/fields`, { name: "Estimate", type: "number" });
  const done = await call("POST", `/databases/${T}/fields`, { name: "Done", type: "checkbox" });
  const due = await call("POST", `/databases/${T}/fields`, { name: "Due", type: "date" });
  const rel = await call("POST", `/databases/${T}/fields`, { name: "Project", type: "relation", config: { relation: { databaseId: P } }, twoWay: true, reverseName: "Tasks" });
  check(rel.config.relation.reverseFieldId, "two-way relation creates reverse field");

  const p1 = await call("POST", "/pages", { parentId: P, title: "Apollo" });
  check(p1.databaseId === P, "page under a database becomes its row");
  const mk = (title: string, values: Record<string, unknown>) => call("POST", "/pages", { parentId: T, title, values });
  const opts = status.config.options;
  await mk("Design", { [est.id]: 3, [done.id]: true, [status.id]: opts[2].id, [due.id]: "2030-01-05", [rel.id]: [p1.id] });
  await mk("Build", { [est.id]: 8, [done.id]: false, [status.id]: opts[1].id, [due.id]: "2030-01-20", [rel.id]: [p1.id] });
  await mk("Ship", { [est.id]: 2, [status.id]: opts[0].id });

  const pRow = await call("GET", `/records/${p1.id}`);
  check((pRow.values[rel.config.relation.reverseFieldId] ?? []).length === 2, "reverse relation synced (project has 2 tasks)");

  // rollup + formula on Projects
  const sum = await call("POST", `/databases/${P}/fields`, {
    name: "Total estimate",
    type: "rollup",
    config: { rollup: { relationFieldId: rel.config.relation.reverseFieldId, targetFieldId: est.id, fn: "sum" } },
  });
  const pct = await call("POST", `/databases/${P}/fields`, {
    name: "Progress",
    type: "rollup",
    config: { rollup: { relationFieldId: rel.config.relation.reverseFieldId, targetFieldId: done.id, fn: "percent_checked" } },
  });
  const f = await call("POST", `/databases/${P}/fields`, {
    name: "Summary",
    type: "formula",
    config: { formula: { expression: 'prop("Name") + ": " + format(prop("Total estimate")) + "h, " + format(prop("Progress")) + "%"' } },
  });
  check(f.valueType === "text" && !f.error, "formula compiles with text result");
  const pq = await call("POST", `/databases/${P}/query`, {});
  const apollo = pq.rows.find((r: any) => r.id === p1.id);
  check(apollo.values[sum.id] === 11, "rollup sum = 11");
  check(apollo.values[pct.id] === 50, "rollup percent_checked = 50");
  check(apollo.values[f.id] === "Apollo: 11h, 50%", `formula value (${apollo.values[f.id]})`);

  const bad = await call("POST", `/databases/${P}/fields`, { name: "Broken", type: "formula", config: { formula: { expression: 'prop("Nope") +' } } });
  check(bad.error, "invalid formula reports an error instead of failing");

  // filters + sorts
  const q1 = await call("POST", `/databases/${T}/query`, {
    filter: { id: "g", conjunction: "and", conditions: [{ id: "c", fieldId: est.id, operator: "gte", value: 3 }] },
    sorts: [{ fieldId: est.id, direction: "desc" }],
  });
  check(q1.rows.map((r: any) => r.title).join() === "Build,Design", "number filter + sort");
  const q2 = await call("POST", `/databases/${T}/query`, {
    filter: { id: "g", conjunction: "or", conditions: [{ id: "a", fieldId: done.id, operator: "is_checked" }, { id: "b", fieldId: "title", operator: "contains", value: "shi" }] },
  });
  check(q2.rows.length === 2, "OR filter with checkbox + title contains");
  const q3 = await call("POST", `/databases/${T}/query`, { filter: { id: "g", conjunction: "and", conditions: [{ id: "d", fieldId: due.id, operator: "after", value: "2030-01-10" }] } });
  check(q3.rows.length === 1 && q3.rows[0].title === "Build", "date filter");
  const q4 = await call("POST", `/databases/${T}/query`, { filter: { id: "g", conjunction: "and", conditions: [{ id: "s", fieldId: status.id, operator: "is", value: opts[1].id }] } });
  check(q4.rows.length === 1, "status filter");
  check(Object.keys(q1.relations).includes(p1.id), "query returns relation titles");
  const q5 = await call("POST", `/databases/${P}/query`, { filter: { id: "g", conjunction: "and", conditions: [{ id: "r", fieldId: sum.id, operator: "gt", value: 10 }] } });
  check(q5.rows.length === 1, "filter on rollup value");

  // views
  const kanban = await call("POST", `/databases/${T}/views`, { name: "Board", type: "kanban" });
  check(kanban.config.groupBy?.fieldId === status.id, "kanban auto-groups by status");
  const cal = await call("POST", `/databases/${T}/views`, { name: "Calendar", type: "calendar" });
  check(cal.config.calendar?.dateFieldId === due.id, "calendar picks the date field");
  await call("PATCH", `/views/${kanban.id}`, { config: { ...kanban.config, sorts: [{ fieldId: "title", direction: "asc" }] } });
  const vq = await call("POST", `/databases/${T}/query`, { viewId: kanban.id });
  check(vq.rows[0].title === "Build", "query honours view sorts");

  // type changes
  const tag = await call("POST", `/databases/${T}/fields`, { name: "Label", type: "text" });
  const rows = (await call("POST", `/databases/${T}/query`, {})).rows;
  await call("PATCH", `/records/${rows[0].id}/values`, { values: { [tag.id]: "red, blue" } });
  await call("PATCH", `/records/${rows[1].id}/values`, { values: { [tag.id]: "blue" } });
  const ms = await call("PATCH", `/fields/${tag.id}`, { type: "multi_select" });
  check(ms.config.options.length === 2, "text → multi_select creates options from values");
  const after = (await call("POST", `/databases/${T}/query`, {})).rows;
  check(after.find((r: any) => r.id === rows[0].id).values[tag.id].length === 2, "values converted to option ids");
  const back = await call("PATCH", `/fields/${tag.id}`, { type: "text" });
  const after2 = (await call("POST", `/databases/${T}/query`, {})).rows;
  check(back.type === "text" && after2.find((r: any) => r.id === rows[0].id).values[tag.id] === "red, blue", "multi_select → text restores names");
  const renamed = await call("PATCH", `/fields/${est.id}`, { name: "Hours" });
  check(renamed.name === "Hours", "rename field");
  const fAfter = (await call("GET", `/databases/${P}`)).fields.find((x: any) => x.id === f.id);
  check(!fAfter.error, "formula still valid after renaming a field it reaches via rollup");

  // invalid values are rejected
  let rejected = false;
  try {
    await call("PATCH", `/records/${rows[0].id}/values`, { values: { [status.id]: "not-an-option" } });
  } catch {
    rejected = true;
  }
  check(rejected, "unknown select option rejected");

  // move + trash
  await call("PATCH", `/records/${rows[2].id}`, { parentId: null });
  const moved = await call("GET", `/records/${rows[2].id}`);
  check(moved.databaseId === t.defaultDatabaseId, "moving a row out of a database rehomes it to Notes");
  await call("DELETE", `/records/${parent.id}`);
  const trash = await call("GET", "/trash");
  check(trash.items.some((i: any) => i.id === parent.id), "trash lists the deleted subtree root");
  const treeAfter = await call("GET", "/tree");
  check(!treeAfter.nodes.some((n: any) => n.id === child.id), "trashed subtree hidden from tree");
  await call("POST", `/records/${parent.id}/restore`);
  check((await call("GET", "/tree")).nodes.some((n: any) => n.id === child.id), "restore brings back the subtree");
  await call("DELETE", `/records/${parent.id}`);
  await call("DELETE", `/records/${parent.id}/permanent`);
  let gone = false;
  try {
    await call("GET", `/records/${P}`);
  } catch {
    gone = true;
  }
  check(gone, "permanent delete removes nested databases");
  await call("DELETE", `/records/${rows[2].id}`);
  await call("DELETE", `/records/${rows[2].id}/permanent`);

  console.log(`\n${passed} checks passed`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exitCode = 1;
});
