import { describe, expect, it } from "vitest";
import type { Item } from "@shared/model";
import { edgeEnds, routeEdge, rectsIntersect, normRect } from "./geometry";
import { handleToColumn } from "../../lib/flow-graph";

const mk = (over: Partial<Item> & { id: string }): Item => ({
  boardId: "b", key: null, type: "shape", parentId: null, x: 0, y: 0, width: 100, height: 60, zIndex: 0, locked: false, pinned: false, version: 1,
  data: {}, createdBy: "u", updatedBy: "u", createdAt: "", updatedAt: "", ...over,
});
const toMap = (items: Item[]) => new Map(items.map((i) => [i.id, i]));

describe("canvas geometry", () => {
  it("anchors an edge on the facing sides, using absolute (parent-relative) positions", () => {
    const map = toMap([
      mk({ id: "g", type: "group", x: 500, y: 0, width: 400, height: 300 }),
      mk({ id: "a", x: 0, y: 0 }),
      mk({ id: "b", parentId: "g", x: 50, y: 20 }), // abs (550, 20) → to the right of a
      mk({ id: "e", type: "edge", data: { from: { itemId: "a" }, to: { itemId: "b" } } }),
    ]);
    const ends = edgeEnds(map, map.get("e")!)!;
    expect(ends.a.side).toBe("r"); // leaves a on the right
    expect(ends.b.side).toBe("l"); // enters b on the left
    expect(ends.a.p).toEqual({ x: 100, y: 30 });
    expect(ends.b.p).toEqual({ x: 550, y: 50 });
  });

  it("anchors ERD relations on the exact column row", () => {
    const map = toMap([
      mk({ id: "orders", type: "entity", x: 0, y: 0, width: 250, height: 90, data: { columns: [{ id: "user_id" }] } }),
      mk({ id: "users", type: "entity", x: 400, y: 0, width: 250, height: 70, data: { columns: [{ id: "id" }] } }),
      mk({ id: "r", type: "edge", data: { from: { itemId: "orders", handle: "user_id" }, to: { itemId: "users", handle: "id" } } }),
    ]);
    const ends = edgeEnds(map, map.get("r")!)!;
    expect(ends.a.p.x).toBe(250); // right edge of orders
    expect(ends.a.p.y).toBe(0 + 32 + 12); // header + first row centre
    expect(ends.b.p.x).toBe(400); // left edge of users
  });

  it("routes an orthogonal path with a jog between opposite horizontal anchors", () => {
    const a = { p: { x: 100, y: 30 }, dir: { x: 1, y: 0 } };
    const b = { p: { x: 550, y: 50 }, dir: { x: -1, y: 0 } };
    const { d, label } = routeEdge(a, b, "orthogonal");
    expect(d.startsWith("M 100 30")).toBe(true);
    expect(d.endsWith("L 550 50")).toBe(true);
    expect(d).toContain("Q"); // rounded corners
    expect(label.x).toBeGreaterThan(100);
    expect(label.x).toBeLessThan(550);
  });

  it("normalises and intersects rects", () => {
    const r = normRect(10, 20, 0, 5);
    expect(r).toEqual({ x: 0, y: 5, width: 10, height: 15 });
    expect(rectsIntersect(r, { x: 5, y: 5, width: 5, height: 5 })).toBe(true);
    expect(rectsIntersect(r, { x: 50, y: 50, width: 5, height: 5 })).toBe(false);
  });

  it("maps handle ids back to columns", () => {
    expect(handleToColumn("user_id:r")).toBe("user_id");
    expect(handleToColumn("r")).toBeUndefined();
  });
});
