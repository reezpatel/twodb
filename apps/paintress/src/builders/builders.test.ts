import { describe, expect, it } from "vitest";
import { DiagramRequest, ErdRequest, ProcessRequest } from "../shared/dto.js";
import { buildDiagram } from "./diagram.js";
import { buildErd } from "./erd.js";
import { buildProcess } from "./process.js";
import { parseMermaid } from "./mermaid.js";
import { resolveIcon, searchIcons } from "../icons.js";
import type { Item } from "../shared/model.js";

const creates = (ops: { op: string }[]) => ops.filter((o) => o.op === "create").length;

describe("icons", () => {
  it("finds aws and gcp icons", () => {
    expect(resolveIcon("logos:aws-lambda")).toBe("logos:aws-lambda");
    expect(resolveIcon("aws lambda")).toBe("logos:aws-lambda");
    expect(searchIcons("bigquery", { set: "gcp" })[0]?.id).toBe("gcp:bigquery");
    expect(resolveIcon("postgres")).toMatch(/^logos:postgres/);
  });
});

describe("diagram builder", () => {
  it("lays out nested groups with edges", async () => {
    const req = DiagramRequest.parse({
      groups: [
        { key: "vpc", title: "VPC", style: "aws-vpc" },
        { key: "priv", title: "Private", style: "aws-subnet-private", parent: "vpc" },
      ],
      nodes: [
        { key: "web", label: "Web", icon: "logos:react" },
        { key: "api", label: "API", icon: "aws lambda", parent: "priv" },
        { key: "db", label: "DB", shape: "cylinder", parent: "priv" },
      ],
      edges: [
        { from: "web", to: "api", label: "HTTPS", step: 1 },
        { from: "api", to: "db", kind: "async" },
      ],
    });
    const plan = await buildDiagram(req, []);
    expect(plan.created).toBe(7);
    expect(plan.warnings).toEqual([]);
    // parents are created before children
    const order = plan.ops.map((o) => (o.op === "create" ? o.item.key : ""));
    expect(order.indexOf("vpc")).toBeLessThan(order.indexOf("priv"));
    expect(order.indexOf("priv")).toBeLessThan(order.indexOf("api"));
    const vpc = plan.ops.find((o) => o.op === "create" && o.item.key === "vpc");
    expect(vpc && vpc.op === "create" && vpc.item.width).toBeGreaterThan(200);
  });

  it("merge updates by key and keeps pinned positions", async () => {
    const req = DiagramRequest.parse({ nodes: [{ key: "a", label: "A" }, { key: "b", label: "B" }] });
    const first = await buildDiagram(req, []);
    const items: Item[] = first.ops.flatMap((o) =>
      o.op === "create"
        ? [{ ...o.item, id: o.item.id!, boardId: "b", key: o.item.key ?? null, parentId: null, width: 1, height: 1, zIndex: 0, locked: false, pinned: o.item.key === "a", version: 1, data: o.item.data, createdBy: "x", updatedBy: "x", createdAt: "", updatedAt: "", x: 500, y: 500 } as Item]
        : [],
    );
    const again = await buildDiagram(req, items);
    expect(creates(again.ops)).toBe(0);
    const upA = again.ops.find((o) => o.op === "update" && o.id === items[0]!.id);
    const upB = again.ops.find((o) => o.op === "update" && o.id === items[1]!.id);
    expect(upA && upA.op === "update" && "x" in upA.patch).toBe(false);
    expect(upB && upB.op === "update" && "x" in upB.patch).toBe(true);
  });

  it("warns on unknown icon/shape/endpoint", async () => {
    const plan = await buildDiagram(
      DiagramRequest.parse({ nodes: [{ key: "a", label: "A", icon: "zzzzqqq", shape: "nope" }], edges: [{ from: "a", to: "ghost" }] }),
      [],
    );
    expect(plan.warnings.length).toBe(3);
    expect(creates(plan.ops)).toBe(1);
  });
});

describe("erd builder", () => {
  it("derives relations from fk and sets cardinality", async () => {
    const plan = await buildErd(
      ErdRequest.parse({
        entities: [
          { key: "users", columns: [{ name: "id", type: "uuid", pk: true }, { name: "email", type: "text", unique: true }] },
          { key: "orders", columns: [{ name: "id", type: "uuid", pk: true }, { name: "user_id", type: "uuid", fk: "users.id" }] },
        ],
      }),
      [],
    );
    expect(plan.warnings).toEqual([]);
    const edge = plan.ops.find((o) => o.op === "create" && o.item.type === "edge");
    expect(edge && edge.op === "create" && edge.item.data).toMatchObject({
      kind: "relation",
      cardinality: { from: "zero_or_many", to: "one" },
      from: { handle: "user_id" },
      to: { handle: "id" },
    });
  });
});

describe("process builder", () => {
  it("places steps inside lanes inside a pool", async () => {
    const plan = await buildProcess(
      ProcessRequest.parse({
        lanes: [{ key: "cust", title: "Customer" }, { key: "ops", title: "Ops" }],
        steps: [
          { key: "s", lane: "cust", label: "Start", shape: "terminator" },
          { key: "t", lane: "ops", label: "Review", shape: "task" },
          { key: "d", lane: "ops", label: "OK?", shape: "decision" },
        ],
        flows: [{ from: "s", to: "t" }, { from: "t", to: "d" }, { from: "d", to: "s", label: "no" }],
      }),
      [],
    );
    const get = (k: string) => plan.ops.find((o) => o.op === "create" && o.item.key === k);
    expect(get("pool")).toBeTruthy();
    const t = get("t");
    expect(t && t.op === "create" && t.item.parentId).toBe(plan.keyToId["lane:ops"]);
    const s = get("s"), d = get("d");
    // back-edge (d -> s) must not push s to the right of d
    expect(s && s.op === "create" && s.item.x).toBeLessThan(d && d.op === "create" ? d.item.x : 0);
  });
});

describe("mermaid import", () => {
  it("parses flowcharts with shapes, labels and subgraphs", () => {
    const m = parseMermaid(`flowchart LR
      subgraph backend [Backend]
        A[API] -->|calls| B[(DB)]
      end
      C{Ok?} -- yes --> A
      C -.-> D([End])
      A & B --> E`);
    expect(m.type).toBe("flowchart");
    if (m.type !== "flowchart") return;
    expect(m.diagram.direction).toBe("LR");
    expect(m.diagram.groups[0]).toMatchObject({ key: "backend", title: "Backend" });
    const byKey = Object.fromEntries(m.diagram.nodes.map((n) => [n.key, n]));
    expect(byKey.B).toMatchObject({ shape: "database", parent: "backend" });
    expect(byKey.C).toMatchObject({ shape: "decision" });
    expect(byKey.D).toMatchObject({ shape: "terminator" });
    expect(m.diagram.edges).toContainEqual(expect.objectContaining({ from: "A", to: "B", label: "calls" }));
    expect(m.diagram.edges).toContainEqual(expect.objectContaining({ from: "C", to: "A", label: "yes" }));
    expect(m.diagram.edges).toContainEqual(expect.objectContaining({ from: "C", to: "D", dashed: true }));
    expect(m.diagram.edges.filter((e) => e.to === "E").length).toBe(2);
  });

  it("parses erDiagram", () => {
    const m = parseMermaid(`erDiagram
      CUSTOMER ||--o{ ORDER : places
      CUSTOMER {
        int id PK
        string name
      }
      ORDER {
        int id PK
        int customer_id FK
      }`);
    expect(m.type).toBe("erDiagram");
    if (m.type !== "erDiagram") return;
    expect(m.erd.entities.map((e) => e.key)).toEqual(["CUSTOMER", "ORDER"]);
    expect(m.erd.relations[0]).toMatchObject({
      from: "ORDER.customer_id",
      to: "CUSTOMER.id",
      label: "places",
      cardinality: { from: "zero_or_many", to: "one" },
    });
  });

  it("rejects unsupported types with guidance", () => {
    expect(() => parseMermaid("sequenceDiagram\nA->>B: hi")).toThrow(/Unsupported/);
  });
});
