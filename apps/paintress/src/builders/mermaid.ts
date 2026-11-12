// Small Mermaid importer: `flowchart`/`graph` and `erDiagram` become native,
// editable items. (Mermaid itself needs a DOM; LLM-written diagrams only use a
// small, regular subset, so we parse that subset directly.)
import type { DiagramRequest, ErdRequest } from "../shared/dto.js";
import type { Cardinality } from "../shared/model.js";

export type MermaidParsed =
  | { type: "flowchart"; diagram: Pick<DiagramRequest, "groups" | "nodes" | "edges" | "direction"> }
  | { type: "erDiagram"; erd: Pick<ErdRequest, "entities" | "relations"> };

export class MermaidError extends Error {}

function cleanLines(src: string): string[] {
  return src
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/%%.*$/, "").trim())
    .filter(Boolean);
}

export function parseMermaid(source: string): MermaidParsed {
  const lines = cleanLines(source.replace(/^```(?:mermaid)?\s*|```\s*$/g, ""));
  const head = lines[0]?.toLowerCase() ?? "";
  if (/^(flowchart|graph)\b/.test(head)) return { type: "flowchart", diagram: parseFlowchart(lines) };
  if (/^erdiagram\b/.test(head)) return { type: "erDiagram", erd: parseEr(lines) };
  throw new MermaidError(
    `Unsupported Mermaid type "${lines[0] ?? ""}". Supported: flowchart/graph and erDiagram. For other diagrams use POST /diagram, or put the Mermaid in a doc board.`,
  );
}

// ---------------------------------------------------------------------------
// flowchart
// ---------------------------------------------------------------------------
const SHAPES: [RegExp, string][] = [
  [/^\(\[(.*)\]\)$/s, "flowchart:terminator"],
  [/^\[\((.*)\)\]$/s, "flowchart:database"],
  [/^\(\((.*)\)\)$/s, "flowchart:connector"],
  [/^\{\{(.*)\}\}$/s, "flowchart:preparation"],
  [/^\[\/(.*)\/\]$/s, "flowchart:io"],
  [/^\[\\(.*)\\\]$/s, "flowchart:manual-operation"],
  [/^\[\[(.*)\]\]$/s, "flowchart:predefined"],
  [/^\{(.*)\}$/s, "flowchart:decision"],
  [/^\((.*)\)$/s, "basic:rounded"],
  [/^>(.*)\]$/s, "basic:note"],
  [/^\[(.*)\]$/s, "flowchart:process"],
];

const unquote = (s: string) => s.trim().replace(/^"(.*)"$/s, "$1").replace(/<br\s*\/?>/gi, "\n");

const ID = "[A-Za-z0-9_][A-Za-z0-9_.-]*";
const NODE_RE = new RegExp(`^(${ID})\\s*((?:\\(\\[|\\[\\(|\\(\\(|\\{\\{|\\[\\/|\\[\\\\|\\[\\[|\\[|\\(|\\{|>).*)?$`, "s");
// arrow tokens: -->, ---, -.->, ==>, --o, --x, <-->, optional |label| or -- label -->
const ARROW_RE = /\s*(<?(?:-->|---|-\.->|-\.-|==>|===|--[ox]|~~~))(?:\|([^|]*)\|)?\s*/;
const LABELLED_ARROW_RE = /\s*(<?(?:--|==|-\.))\s+([^->=.]+?)\s+(-->|---|==>|===|\.->)\s*/;

function parseNodeToken(tok: string, nodes: Map<string, { label: string; shape?: string; pack?: string }>) {
  const m = NODE_RE.exec(tok.trim());
  if (!m) throw new MermaidError(`Cannot parse node "${tok}"`);
  const id = m[1]!;
  const rest = m[2]?.trim();
  if (rest) {
    for (const [re, full] of SHAPES) {
      const sm = re.exec(rest);
      if (sm) {
        const [pack, shape] = full.split(":") as [string, string];
        nodes.set(id, { label: unquote(sm[1]!), shape, pack });
        return id;
      }
    }
    throw new MermaidError(`Unsupported node shape in "${tok}"`);
  }
  if (!nodes.has(id)) nodes.set(id, { label: id });
  return id;
}

function parseFlowchart(lines: string[]): Pick<DiagramRequest, "groups" | "nodes" | "edges" | "direction"> {
  const dirM = /^(?:flowchart|graph)\s+(TB|TD|BT|LR|RL)/i.exec(lines[0]!);
  const dir = (dirM?.[1] ?? "TB").toUpperCase();
  const direction = (dir === "TD" ? "TB" : dir) as "TB" | "BT" | "LR" | "RL";
  const nodes = new Map<string, { label: string; shape?: string; pack?: string; parent?: string }>();
  const groups: DiagramRequest["groups"] = [];
  const edges: DiagramRequest["edges"] = [];
  const stack: string[] = [];

  for (const line of lines.slice(1)) {
    const sg = /^subgraph\s+(.+)$/i.exec(line);
    if (sg) {
      // `subgraph id [Title]` or `subgraph Title`
      const m = /^(\S+)\s*\[(.*)\]$/.exec(sg[1]!.trim());
      const id = m ? m[1]! : sg[1]!.trim().replace(/\s+/g, "_");
      groups.push({ key: id, title: unquote(m ? m[2]! : sg[1]!), parent: stack[stack.length - 1], style: "plain" });
      stack.push(id);
      continue;
    }
    if (/^end$/i.test(line)) {
      stack.pop();
      continue;
    }
    if (/^(direction|classDef|class|style|linkStyle|click)\b/i.test(line)) continue;

    // Split a statement into node tokens and arrows: A --> B -->|x| C
    let rest = line;
    const tokens: string[] = [];
    const arrows: { label?: string; kind: string }[] = [];
    for (;;) {
      const cand = [ARROW_RE.exec(rest), LABELLED_ARROW_RE.exec(rest)].filter(Boolean) as RegExpExecArray[];
      if (!cand.length) break;
      const a = cand.sort((x, y) => x.index - y.index)[0]!;
      const isLabelled = a === cand.find((c) => c[3] !== undefined && c[2] !== undefined && /^[^|]*$/.test(c[2]!)) && a[3] !== undefined;
      tokens.push(rest.slice(0, a.index));
      arrows.push({ label: a[2] !== undefined ? unquote(a[2]) || undefined : undefined, kind: isLabelled ? a[3]! : a[1]! });
      rest = rest.slice(a.index + a[0].length);
    }
    tokens.push(rest);
    // `A & B --> C` fan-in/out
    const groupsOfIds = tokens.map((t) =>
      t
        .split("&")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => parseNodeToken(x, nodes)),
    );
    for (const id of groupsOfIds.flat()) if (stack.length && !nodes.get(id)!.parent) nodes.get(id)!.parent = stack[stack.length - 1];
    for (let i = 0; i < arrows.length; i++) {
      const a = arrows[i]!;
      const dashed = /\./.test(a.kind);
      for (const from of groupsOfIds[i] ?? [])
        for (const to of groupsOfIds[i + 1] ?? [])
          edges.push({ from, to, ...(a.label ? { label: a.label } : {}), ...(dashed ? { dashed: true } : {}), ...(/^</.test(a.kind) ? { bidirectional: true } : {}) });
    }
  }
  return {
    direction,
    groups,
    nodes: [...nodes].map(([key, n]) => ({ key, label: n.label, ...(n.shape ? { shape: n.shape, pack: n.pack } : { shape: "process", pack: "flowchart" }), ...(n.parent ? { parent: n.parent } : {}) })),
    edges,
  };
}

// ---------------------------------------------------------------------------
// erDiagram
// ---------------------------------------------------------------------------
const REL_RE = /^(\S+)\s+([|o}{][|o}{]?)(--|\.\.)([|o}{][|o}{]?)\s+(\S+)\s*(?::\s*(.*))?$/;

function leftCard(s: string): Cardinality {
  // read from the entity outward: `}o`, `}|`, `|o`, `||`
  if (s === "||") return "one";
  if (s === "|o" || s === "o|") return "zero_or_one";
  if (s === "}o" || s === "o{") return "zero_or_many";
  if (s === "}|" || s === "|{") return "one_or_many";
  return "one";
}

function parseEr(lines: string[]): Pick<ErdRequest, "entities" | "relations"> {
  const entities = new Map<string, ErdRequest["entities"][number]>();
  const relations: ErdRequest["relations"] = [];
  const ent = (name: string) => {
    const n = name.replace(/^"|"$/g, "");
    if (!entities.has(n)) entities.set(n, { key: n, name: n, columns: [] });
    return entities.get(n)!;
  };
  let current: ErdRequest["entities"][number] | null = null;
  const pending: { entity: string; column: string; fk: string }[] = [];
  const raw: { left: string; lc: string; rc: string; right: string; label?: string }[] = [];

  for (const line of lines.slice(1)) {
    if (current) {
      if (line === "}") {
        current = null;
        continue;
      }
      // type name [PK|FK|UK ...] ["comment"]
      const m = /^(\S+)\s+(\S+)(?:\s+((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*))?(?:\s+"(.*)")?$/.exec(line);
      if (!m) throw new MermaidError(`Cannot parse attribute "${line}"`);
      const flags = (m[3] ?? "").split(/\s*,\s*/);
      current.columns.push({
        name: m[2]!,
        type: m[1]!,
        ...(flags.includes("PK") ? { pk: true } : {}),
        ...(flags.includes("UK") ? { unique: true } : {}),
      });
      if (flags.includes("FK")) pending.push({ entity: current.key, column: m[2]!, fk: "" });
      continue;
    }
    const open = /^(\S+)\s*\{$/.exec(line);
    if (open) {
      current = ent(open[1]!);
      continue;
    }
    const r = REL_RE.exec(line);
    if (r) {
      ent(r[1]!);
      ent(r[5]!);
      raw.push({ left: r[1]!, lc: r[2]!, rc: r[4]!, right: r[5]!, label: r[6] });
      continue;
    }
    if (/^\S+$/.test(line)) {
      ent(line);
      continue;
    }
    throw new MermaidError(`Cannot parse line "${line}"`);
  }
  // Resolve relations once every entity body is known. `A ||--o{ B`: A is the one side;
  // our relation points many -> one and attaches to the FK / PK columns where they exist.
  for (const r of raw) {
    const a = ent(r.left);
    const b = ent(r.right);
    const oneIsLeft = ["one", "zero_or_one"].includes(leftCard(r.lc));
    const parent = oneIsLeft ? a : b;
    const child = oneIsLeft ? b : a;
    const pk = parent.columns.find((c) => c.pk)?.name ?? "id";
    const fkCol = child.columns.find((c) => pending.some((p) => p.entity === child.key && p.column === c.name));
    relations.push({
      from: `${child.key}.${fkCol?.name ?? `${parent.key.toLowerCase()}_id`}`,
      to: `${parent.key}.${pk}`,
      ...(r.label ? { label: r.label.replace(/^"|"$/g, "") } : {}),
      cardinality: oneIsLeft ? { from: rightCard(r.rc), to: leftCard(r.lc) } : { from: leftCard(r.lc), to: rightCard(r.rc) },
    });
  }
  return { entities: [...entities.values()], relations };
}

function rightCard(s: string): Cardinality {
  if (s === "||") return "one";
  if (s === "o|" || s === "|o") return "zero_or_one";
  if (s === "o{" || s === "}o") return "zero_or_many";
  if (s === "|{" || s === "}|") return "one_or_many";
  return "one";
}
