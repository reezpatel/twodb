import { describe, expect, it } from "vitest";
import { cloneOps, containerAt } from "./containers";
import type { Item } from "@shared/model";

const mk = (over: Partial<Item> & { id: string }): Item => ({
  boardId: "b", key: null, type: "shape", parentId: null, x: 0, y: 0, width: 100, height: 60, zIndex: 0, locked: false, pinned: false, version: 1,
  data: {}, createdBy: "u", updatedBy: "u", createdAt: "", updatedAt: "", ...over,
});
const toMap = (items: Item[]) => new Map(items.map((i) => [i.id, i]));

describe("containers", () => {
  const map = toMap([
    mk({ id: "vpc", type: "group", x: 100, y: 100, width: 500, height: 400 }),
    mk({ id: "sub", type: "group", parentId: "vpc", x: 50, y: 50, width: 200, height: 200 }),
    mk({ id: "n", x: 20, y: 20, parentId: "sub" }),
  ]);

  it("finds the deepest container using absolute coordinates", () => {
    expect(containerAt(map, { x: 200, y: 200 }, new Set())?.id).toBe("sub"); // abs sub = (150,150)..(350,350)
    expect(containerAt(map, { x: 550, y: 450 }, new Set())?.id).toBe("vpc");
    expect(containerAt(map, { x: 10, y: 10 }, new Set())).toBeNull();
  });

  it("never drops a group into itself or its own children", () => {
    expect(containerAt(map, { x: 200, y: 200 }, new Set(["vpc"]))).toBeNull();
    expect(containerAt(map, { x: 200, y: 200 }, new Set(["sub"]))?.id).toBe("vpc");
  });

  it("clones a group with its contents, remapping parents and internal edges", () => {
    const m = toMap([
      ...map.values(),
      mk({ id: "m", x: 100, y: 100, parentId: "sub" }),
      mk({ id: "e1", type: "edge", data: { from: { itemId: "n" }, to: { itemId: "m" } } }),
      mk({ id: "e2", type: "edge", data: { from: { itemId: "n" }, to: { itemId: "outside" } } }),
    ]);
    const { ops } = cloneOps(m, [m.get("vpc")!], { x: 24, y: 24 });
    const creates = ops.filter((o) => o.op === "create").map((o) => (o as { item: any }).item);
    expect(creates.filter((c) => c.type !== "edge")).toHaveLength(4);
    const vpc = creates.find((c) => c.type === "group" && c.width === 500);
    expect(vpc).toMatchObject({ x: 124, y: 124, parentId: null });
    const child = creates.find((c) => c.type === "shape" && c.x === 20);
    expect(child.x).toBe(20); // children keep relative coords (no offset)
    const subCopy = creates.find((c) => c.type === "group" && c.width === 200);
    expect(subCopy.parentId).toBe(vpc.id);
    const edges = creates.filter((c) => c.type === "edge");
    expect(edges).toHaveLength(1); // e2 points outside the copy: dropped
    expect(edges[0].data.from.itemId).not.toBe("n");
  });
});
