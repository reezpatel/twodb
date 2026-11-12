// Shared between the Fastify server, the webapp and (via /catalog) agents.
// Pure types + Zod schemas: no node or DOM imports here.
import { z } from "zod";

export const BOARD_KINDS = ["diagram", "doc"] as const;
export const BoardKind = z.enum(BOARD_KINDS);
export type BoardKind = z.infer<typeof BoardKind>;

export const ITEM_TYPES = ["shape", "group", "pool", "lane", "entity", "edge", "sticky", "text", "image"] as const;
export const ItemType = z.enum(ITEM_TYPES);
export type ItemType = z.infer<typeof ItemType>;

// ---------------------------------------------------------------------------
// Per-type `data` payloads. They are stored as jsonb and validated on write.
// ---------------------------------------------------------------------------
const color = z.string().max(40);

export const ShapeData = z.object({
  pack: z.string().default("basic"),
  shape: z.string().default("rectangle"),
  text: z.string().optional(),
  sublabel: z.string().optional(),
  icon: z.string().optional().describe('Icon id such as "logos:aws-lambda" or "gcp:compute-engine"'),
  fill: color.optional(),
  stroke: color.optional(),
  dashed: z.boolean().optional(),
  fontSize: z.number().optional(),
});

export const GroupData = z.object({
  pack: z.string().default("basic"),
  kind: z.string().default("plain"),
  title: z.string().default(""),
  icon: z.string().optional(),
  fill: color.optional(),
  stroke: color.optional(),
  dashed: z.boolean().optional(),
});

export const PoolData = z.object({ title: z.string().default("") });
export const LaneData = z.object({ title: z.string().default(""), fill: color.optional() });

export const Column = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().default(""),
  pk: z.boolean().optional(),
  fk: z.object({ entity: z.string(), column: z.string() }).optional(),
  nullable: z.boolean().optional(),
  unique: z.boolean().optional(),
});
export type Column = z.infer<typeof Column>;

export const EntityData = z.object({
  name: z.string(),
  columns: z.array(Column).default([]),
  color: color.optional(),
});

export const CARDINALITIES = ["one", "zero_or_one", "many", "zero_or_many", "one_or_many"] as const;
export const Cardinality = z.enum(CARDINALITIES);
export type Cardinality = z.infer<typeof Cardinality>;

export const EDGE_KINDS = ["flow", "sync", "async", "data", "dep", "relation"] as const;

export const EdgeEnd = z.object({ itemId: z.string(), handle: z.string().optional() });
export const EdgeData = z.object({
  from: EdgeEnd,
  to: EdgeEnd,
  label: z.string().optional(),
  step: z.number().int().optional(),
  kind: z.enum(EDGE_KINDS).default("flow"),
  routing: z.enum(["orthogonal", "straight", "bezier"]).default("orthogonal"),
  startCap: z.enum(["none", "arrow", "dot"]).optional(),
  endCap: z.enum(["none", "arrow", "dot"]).optional(),
  cardinality: z.object({ from: Cardinality.optional(), to: Cardinality.optional() }).optional(),
  stroke: color.optional(),
  dashed: z.boolean().optional(),
});
export type EdgeData = z.infer<typeof EdgeData>;

export const StickyData = z.object({ text: z.string().default(""), color: color.default("#fde68a") });
export const TextData = z.object({
  text: z.string().default(""),
  fontSize: z.number().default(16),
  color: color.optional(),
  align: z.enum(["left", "center", "right"]).default("left"),
});
export const ImageData = z.object({ assetId: z.string(), alt: z.string().optional() });

export const DATA_SCHEMAS = {
  shape: ShapeData,
  group: GroupData,
  pool: PoolData,
  lane: LaneData,
  entity: EntityData,
  edge: EdgeData,
  sticky: StickyData,
  text: TextData,
  image: ImageData,
} as const satisfies Record<ItemType, z.ZodType>;

/** Validate (and apply defaults to) an item's data for its type. Throws ZodError. */
export function parseItemData(type: ItemType, data: unknown): Record<string, unknown> {
  return DATA_SCHEMAS[type].parse(data ?? {}) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Items, ops, events
// ---------------------------------------------------------------------------
export const Item = z.object({
  id: z.string(),
  boardId: z.string(),
  key: z.string().nullable(),
  type: ItemType,
  parentId: z.string().nullable(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  zIndex: z.number(),
  locked: z.boolean(),
  pinned: z.boolean(),
  version: z.number().int(),
  data: z.record(z.string(), z.unknown()),
  createdBy: z.string(),
  updatedBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Item = z.infer<typeof Item>;

export const NewItem = z.object({
  id: z.string().optional(),
  key: z.string().nullish(),
  type: ItemType,
  parentId: z.string().nullish(),
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().optional(),
  height: z.number().optional(),
  zIndex: z.number().optional(),
  locked: z.boolean().optional(),
  pinned: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});
export type NewItem = z.infer<typeof NewItem>;

export const ItemPatch = z.object({
  parentId: z.string().nullable().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  zIndex: z.number().optional(),
  locked: z.boolean().optional(),
  pinned: z.boolean().optional(),
  key: z.string().nullable().optional(),
  /** Shallow merge into `data`; a `null` value removes the key. */
  data: z.record(z.string(), z.unknown()).optional(),
});
export type ItemPatch = z.infer<typeof ItemPatch>;

export const Op = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create"), item: NewItem }),
  z.object({ op: z.literal("update"), id: z.string(), patch: ItemPatch, ifVersion: z.number().int().optional() }),
  z.object({ op: z.literal("delete"), id: z.string() }),
]);
export type Op = z.infer<typeof Op>;

export const BatchRequest = z.object({
  ops: z.array(Op).min(1).max(2000),
  label: z.string().max(200).optional(),
  clientId: z.string().max(100).optional(),
});
export type BatchRequest = z.infer<typeof BatchRequest>;

/** What one committed batch did. Clients apply this idempotently. */
export const BoardEvent = z.object({
  seq: z.number().int(),
  boardId: z.string(),
  actor: z.string(),
  origin: z.string().nullable(),
  batchId: z.string(),
  label: z.string().nullable(),
  ts: z.string(),
  upserts: z.array(Item),
  deletes: z.array(z.string()),
  /** Ops that revert this batch (feed to /ops to undo). */
  inverse: z.array(Op),
  doc: z.object({ markdown: z.string(), version: z.number().int() }).nullable(),
});
export type BoardEvent = z.infer<typeof BoardEvent>;

export const BatchResult = z.object({
  seq: z.number().int(),
  batchId: z.string(),
  upserts: z.array(Item),
  deletes: z.array(z.string()),
  inverse: z.array(Op),
  skipped: z.array(z.string()),
});
export type BatchResult = z.infer<typeof BatchResult>;

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------
export const Board = z.object({
  id: z.string(),
  workspaceId: z.string(),
  spaceId: z.string(),
  kind: BoardKind,
  name: z.string(),
  description: z.string(),
  lastSeq: z.number().int(),
  docVersion: z.number().int(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Board = z.infer<typeof Board>;

export const CreateBoard = z.object({
  name: z.string().min(1).max(200),
  kind: BoardKind.default("diagram"),
  description: z.string().max(2000).optional(),
  spaceId: z.string().optional(),
  markdown: z.string().optional().describe("Initial markdown (doc boards only)"),
});

// ---------------------------------------------------------------------------
// WebSocket protocol
// ---------------------------------------------------------------------------
export type ClientMsg =
  | { t: "hello"; clientId: string; since?: number }
  | { t: "ops"; opId: string; label?: string; ops: Op[] }
  | { t: "doc"; opId: string; markdown: string; ifVersion?: number }
  | { t: "ping" };

export type ServerMsg =
  | { t: "snapshot"; seq: number; board: Board; items: Item[]; doc: { markdown: string; version: number } | null }
  | { t: "events"; events: BoardEvent[] }
  | { t: "ack"; opId: string; result: BatchResult }
  | { t: "docAck"; opId: string; seq: number; version: number }
  | { t: "error"; opId?: string; code: string; message: string }
  | { t: "presence"; actors: { actor: string; kind: "human" | "agent" }[] }
  | { t: "pong" };

export function actorKind(actor: string): "human" | "agent" {
  return actor.startsWith("agent:") ? "agent" : "human";
}
