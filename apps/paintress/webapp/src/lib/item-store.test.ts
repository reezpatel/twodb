import { describe, expect, it } from "vitest";
import { adoptVersions, applyEvent, applyOpsLocal, cascade, sortForFlow } from "./item-store";
import type { Item } from "@shared/model";

const mk = (over: Partial<Item> & { id: string }): Item => ({
  boardId: "b", key: null, type: "shape", parentId: null, x: 0, y: 0, width: 10, height: 10, zIndex: 0, locked: false, pinned: false, version: 1,
  data: {}, createdBy: "u", updatedBy: "u", createdAt: "", updatedAt: "", ...over,
});

describe("item store", () => {
  const base = new Map([
    mk({ id: "g", type: "group" }),
    mk({ id: "a", parentId: "g" }),
    mk({ id: "b" }),
    mk({ id: "e", type: "edge", data: { from: { itemId: "a" }, to: { itemId: "b" } } }),
  ].map((i) => [i.id, i]));

  it("cascades deletes to children and attached edges", () => {
    expect([...cascade(base, "g")].sort()).toEqual(["a", "e", "g"]);
    const after = applyOpsLocal(base, [{ op: "delete", id: "g" }], "b", "u");
    expect([...after.keys()]).toEqual(["b"]);
  });

  it("merges data patches and removes null keys", () => {
    const m = new Map([["a", mk({ id: "a", data: { text: "x", icon: "i" } })]]);
    const after = applyOpsLocal(m, [{ op: "update", id: "a", patch: { x: 5, data: { text: "y", icon: null } } }], "b", "u");
    expect(after.get("a")).toMatchObject({ x: 5, data: { text: "y" } });
    expect("icon" in after.get("a")!.data).toBe(false);
  });

  it("applies events idempotently and ignores stale versions", () => {
    const m = new Map([["a", mk({ id: "a", version: 3, x: 9 })]]);
    const stale = applyEvent(m, { upserts: [mk({ id: "a", version: 2, x: 1 })], deletes: [] });
    expect(stale.get("a")!.x).toBe(9);
    const fresh = applyEvent(stale, { upserts: [mk({ id: "a", version: 4, x: 2 })], deletes: [] });
    expect(fresh.get("a")!.x).toBe(2);
    expect(applyEvent(fresh, { upserts: [], deletes: ["a"] }).size).toBe(0);
  });

  it("adopting acked versions keeps our newer local position", () => {
    const m = new Map([["a", mk({ id: "a", version: 1, x: 50 })]]);
    expect(adoptVersions(m, [mk({ id: "a", version: 2, x: 10 })]).get("a")).toMatchObject({ version: 2, x: 50 });
  });

  it("sorts parents before children", () => {
    expect(sortForFlow([mk({ id: "c", parentId: "p" }), mk({ id: "p" })]).map((i) => i.id)).toEqual(["p", "c"]);
  });
});
