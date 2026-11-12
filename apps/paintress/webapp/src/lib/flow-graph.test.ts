import { describe, expect, it } from "vitest";
import { handleToColumn, toFlowEdges, toFlowNodes } from "./flow-graph";
import type { Item } from "@shared/model";

const mk = (over: Partial<Item> & { id: string }): Item => ({
  boardId: "b", key: null, type: "shape", parentId: null, x: 0, y: 0, width: 100, height: 60, zIndex: 0, locked: false, pinned: false, version: 1,
  data: {}, createdBy: "u", updatedBy: "u", createdAt: "", updatedAt: "", ...over,
});
const toMap = (items: Item[]) => new Map(items.map((i) => [i.id, i]));

describe("flow graph", () => {
  it("nests children under parents and picks facing handles using absolute positions", () => {
    const map = toMap([
      mk({ id: "g", type: "group", x: 500, y: 0, width: 400, height: 300 }),
      mk({ id: "a", x: 0, y: 0 }),
      mk({ id: "b", parentId: "g", x: 50, y: 20 }), // absolute x = 550, to the right of a
      mk({ id: "e", type: "edge", data: { from: { itemId: "a" }, to: { itemId: "b" }, endCap: "arrow" } }),
    ]);
    const nodes = toFlowNodes(map, [], new Set());
    expect(nodes.map((n) => n.id)).toEqual(["g", "a", "b"]);
    expect(nodes.find((n) => n.id === "b")).toMatchObject({ parentId: "g", position: { x: 50, y: 20 }, zIndex: 1 });
    const [edge] = toFlowEdges(map, []);
    expect(edge).toMatchObject({ source: "a", target: "b", sourceHandle: "r", targetHandle: "l" });
  });

  it("attaches ERD relations to the exact column row, on the side facing the other table", () => {
    const map = toMap([
      mk({ id: "orders", type: "entity", x: 0, y: 0, width: 250, height: 90 }),
      mk({ id: "users", type: "entity", x: 400, y: 0, width: 250, height: 70 }),
      mk({ id: "r", type: "edge", data: { from: { itemId: "orders", handle: "user_id" }, to: { itemId: "users", handle: "id" }, cardinality: { from: "zero_or_many", to: "one" } } }),
    ]);
    const [edge] = toFlowEdges(map, []);
    expect(edge).toMatchObject({ sourceHandle: "user_id:r", targetHandle: "id:l" });
    expect(edge!.markerEnd).toBeUndefined(); // crow's foot replaces the arrow head
  });

  it("keeps in-flight drag positions and selection across a re-sync", () => {
    const map = toMap([mk({ id: "a", x: 10, y: 10 })]);
    const prev = toFlowNodes(map, [], new Set()).map((n) => ({ ...n, selected: true, dragging: true, position: { x: 99, y: 99 } }));
    const next = toFlowNodes(map, prev, new Set(["a"]));
    expect(next[0]).toMatchObject({ selected: true, position: { x: 99, y: 99 } });
    expect((next[0]!.data as { flash: boolean }).flash).toBe(true);
  });

  it("maps handle ids back to columns", () => {
    expect(handleToColumn("user_id:r")).toBe("user_id");
    expect(handleToColumn("r")).toBeUndefined();
  });
});
