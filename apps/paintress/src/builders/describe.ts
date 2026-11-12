// Compact text outline of a board, for LLM agents to read back what is on it.
import type { Board, Item } from "../shared/model.js";

type Col = { name: string; type?: string; pk?: boolean; fk?: { entity: string; column: string }; nullable?: boolean; unique?: boolean };

export function describeBoard(board: Board, items: Item[], doc?: string): { text: string; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  for (const i of items) counts[i.type] = (counts[i.type] ?? 0) + 1;

  if (board.kind === "doc") {
    return { text: `Doc board "${board.name}" (id ${board.id}, version ${board.docVersion})\n\n${doc ?? ""}`, counts };
  }
  const byId = new Map(items.map((i) => [i.id, i]));
  const ref = (id: string): string => {
    const i = byId.get(id);
    return i ? (i.key ?? labelOf(i) ?? id) : id;
  };
  const labelOf = (i: Item): string | undefined => {
    const d = i.data as Record<string, unknown>;
    return (d.text ?? d.title ?? d.name) as string | undefined;
  };
  const kids = new Map<string | null, Item[]>();
  for (const i of items) {
    if (i.type === "edge") continue;
    const p = i.parentId && byId.has(i.parentId) ? i.parentId : null;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p)!.push(i);
  }
  const lines: string[] = [`Diagram board "${board.name}" (id ${board.id}, seq ${board.lastSeq}) — ${items.length} items`];
  const tag = (i: Item) => `${i.key ? `key=${i.key} ` : ""}id=${i.id}`;
  const walk = (parent: string | null, depth: number) => {
    for (const i of kids.get(parent) ?? []) {
      const d = i.data as Record<string, any>;
      const pad = "  ".repeat(depth);
      if (i.type === "group") lines.push(`${pad}[group:${d.kind}] ${d.title}  (${tag(i)})`);
      else if (i.type === "pool") lines.push(`${pad}[pool] ${d.title}  (${tag(i)})`);
      else if (i.type === "lane") lines.push(`${pad}[lane] ${d.title}  (${tag(i)})`);
      else if (i.type === "entity") {
        lines.push(`${pad}[entity] ${d.name}  (${tag(i)})`);
        for (const c of (d.columns ?? []) as Col[]) {
          const flags = [c.pk && "PK", c.fk && `FK→${c.fk.entity}.${c.fk.column}`, c.unique && "unique", c.nullable && "nullable"].filter(Boolean).join(" ");
          lines.push(`${pad}    ${c.name} ${c.type ?? ""} ${flags}`.trimEnd());
        }
      } else if (i.type === "shape") {
        lines.push(`${pad}- ${d.text ?? "(no text)"}  [${d.pack}:${d.shape}${d.icon ? `, icon ${d.icon}` : ""}]  (${tag(i)})`);
      } else lines.push(`${pad}- ${i.type}${labelOf(i) ? `: ${labelOf(i)}` : ""}  (${tag(i)})`);
      walk(i.id, depth + 1);
    }
  };
  walk(null, 0);
  const edges = items.filter((i) => i.type === "edge");
  if (edges.length) {
    lines.push("", "Connections:");
    for (const e of edges) {
      const d = e.data as Record<string, any>;
      const c = d.cardinality ? ` {${d.cardinality.from ?? "?"} → ${d.cardinality.to ?? "?"}}` : "";
      const col = (end: { itemId: string; handle?: string }) => `${ref(end.itemId)}${end.handle ? "." + end.handle : ""}`;
      lines.push(`  ${col(d.from)} --${d.label ? d.label : ""}${d.step !== undefined ? ` (${d.step})` : ""}--> ${col(d.to)}  [${d.kind}]${c}`);
    }
  }
  return { text: lines.join("\n"), counts };
}
