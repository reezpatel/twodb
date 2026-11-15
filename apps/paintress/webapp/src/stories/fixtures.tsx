import type { ReactNode } from "react";
import type { Board, BoardGroup, Item, ItemType } from "@shared/model";
import type { ItemMap } from "../lib/item-store";
import { DiagramContext, type DiagramActions } from "../board-diagram/DiagramContext";

export const noop = () => {};

let n = 0;
export function item(over: Partial<Item> & { type: ItemType }): Item {
  n += 1;
  return {
    id: over.id ?? `it-${n}`,
    boardId: "board-1",
    key: null,
    parentId: null,
    x: 0,
    y: 0,
    width: 160,
    height: 90,
    zIndex: 0,
    locked: false,
    pinned: false,
    version: 1,
    data: {},
    createdBy: "user:demo",
    updatedBy: "user:demo",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

export const toMap = (items: Item[]): ItemMap => new Map(items.map((i) => [i.id, i]));

/** Diagram actions that do nothing but log — enough for every canvas partial. */
export const fakeActions: DiagramActions = {
  canEdit: true,
  patch: (id, patch, label) => console.log("patch", id, patch, label),
  resized: (id, box) => console.log("resized", id, box),
};

export function WithDiagram(props: { children: ReactNode; canEdit?: boolean }) {
  return <DiagramContext.Provider value={{ ...fakeActions, canEdit: props.canEdit ?? true }}>{props.children}</DiagramContext.Provider>;
}

export function board(over: Partial<Board>): Board {
  return {
    id: over.id ?? "b1",
    workspaceId: "ws",
    groupId: "g1",
    name: "Untitled board",
    kind: "diagram",
    description: "",
    lastSeq: 0,
    docVersion: 0,
    createdBy: "user:demo",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T12:00:00Z",
    ...over,
  };
}

export function group(over: Partial<BoardGroup>): BoardGroup {
  return { id: over.id ?? "g1", workspaceId: "ws", spaceId: "sp1", name: "General", createdBy: "user:demo", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", ...over };
}

/** The sample board used by the canvas stories: AWS-ish + ERD + edge. */
export function sampleItems(): ItemMap {
  const g = item({ id: "g1", type: "group", x: 80, y: 60, width: 380, height: 260, data: { pack: "aws", kind: "aws-vpc", title: "VPC" } });
  const api = item({ id: "n1", type: "shape", parentId: "g1", x: 40, y: 60, width: 160, height: 80, data: { pack: "basic", shape: "rounded", text: "API" } });
  const db = item({ id: "n2", type: "entity", x: 560, y: 80, width: 240, height: 112, data: {
    name: "users",
    columns: [
      { id: "id", name: "id", type: "uuid", pk: true },
      { id: "email", name: "email", type: "text" },
    ],
  } });
  const note = item({ id: "n3", type: "sticky", x: 560, y: 260, width: 160, height: 140, data: { text: "Ship it\non Friday", color: "#fde68a" } });
  const e = item({
    id: "e1",
    type: "edge",
    data: { from: { itemId: "n1" }, to: { itemId: "n2" }, label: "reads", endCap: "arrow" },
  });
  return toMap([g, api, db, note, e]);
}
