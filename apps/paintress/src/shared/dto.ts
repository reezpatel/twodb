// Request/response DTOs for the agent-facing builders (/diagram, /erd, /process, /mermaid, /layout).
import { z } from "zod";
import { Cardinality, EDGE_KINDS, Item, Op } from "./model.js";

const key = z.string().min(1).max(100);
const direction = z.enum(["LR", "TB", "RL", "BT"]).default("LR");
const mode = z
  .enum(["merge", "replace"])
  .default("merge")
  .describe("merge: create or update items by key. replace: wipe the board first.");

export const DiagramGroup = z.object({
  key,
  title: z.string().default(""),
  style: z.string().optional().describe('Group style id, e.g. "aws-vpc", "aws-subnet-private", "gcp-project", "boundary", "plain"'),
  parent: key.optional().describe("Key of the enclosing group"),
  icon: z.string().optional(),
});

export const DiagramNode = z.object({
  key,
  label: z.string(),
  sublabel: z.string().optional(),
  shape: z.string().optional().describe('Shape id, e.g. "rounded", "cylinder", "decision", "terminator", "person"'),
  pack: z.string().optional(),
  icon: z.string().optional().describe('Icon id ("logos:aws-lambda") or a phrase ("aws lambda") that is resolved for you'),
  parent: key.optional().describe("Key of the enclosing group"),
  fill: z.string().optional(),
  stroke: z.string().optional(),
});

export const DiagramEdge = z.object({
  key: key.optional(),
  from: key,
  to: key,
  label: z.string().optional(),
  step: z.number().int().optional().describe("Numbered badge for data-flow order"),
  kind: z.enum(EDGE_KINDS).optional(),
  routing: z.enum(["orthogonal", "straight", "bezier"]).optional(),
  dashed: z.boolean().optional(),
  bidirectional: z.boolean().optional(),
});

export const DiagramRequest = z.object({
  mode,
  direction,
  label: z.string().max(200).optional().describe("Undo-step label shown to the human"),
  relayout: z.boolean().optional().describe("Also move items the human has positioned by hand"),
  origin: z.object({ x: z.number(), y: z.number() }).optional(),
  groups: z.array(DiagramGroup).default([]),
  nodes: z.array(DiagramNode).default([]),
  edges: z.array(DiagramEdge).default([]),
});
export type DiagramRequest = z.infer<typeof DiagramRequest>;

export const ErdColumn = z.object({
  name: z.string(),
  type: z.string().default(""),
  pk: z.boolean().optional(),
  fk: z.string().optional().describe('"entityKey.columnName" this column references'),
  nullable: z.boolean().optional(),
  unique: z.boolean().optional(),
});
export const ErdEntity = z.object({
  key,
  name: z.string().optional(),
  columns: z.array(ErdColumn).default([]),
  color: z.string().optional(),
});
export const ErdRelation = z.object({
  from: z.string().describe('"entityKey.column" (the many / referencing side)'),
  to: z.string().describe('"entityKey.column" (the one / referenced side)'),
  label: z.string().optional(),
  cardinality: z.object({ from: Cardinality.optional(), to: Cardinality.optional() }).optional(),
});
export const ErdRequest = z.object({
  mode,
  direction,
  label: z.string().max(200).optional(),
  relayout: z.boolean().optional(),
  origin: z.object({ x: z.number(), y: z.number() }).optional(),
  entities: z.array(ErdEntity).min(1),
  relations: z.array(ErdRelation).default([]).describe("Extra relations; column `fk` references are turned into relations automatically"),
});
export type ErdRequest = z.infer<typeof ErdRequest>;

export const ProcessStep = z.object({
  key,
  lane: key,
  label: z.string(),
  shape: z.string().default("process").describe("Flowchart or BPMN shape id: process, decision, terminator, task, start-event, end-event, gateway-exclusive, …"),
  pack: z.string().optional(),
});
export const ProcessFlow = z.object({ from: key, to: key, label: z.string().optional() });
export const ProcessRequest = z.object({
  mode,
  label: z.string().max(200).optional(),
  origin: z.object({ x: z.number(), y: z.number() }).optional(),
  title: z.string().default("").describe("Pool title"),
  lanes: z.array(z.object({ key, title: z.string() })).min(1),
  steps: z.array(ProcessStep).min(1),
  flows: z.array(ProcessFlow).default([]),
});
export type ProcessRequest = z.infer<typeof ProcessRequest>;

export const MermaidRequest = z.object({
  source: z.string().min(1).max(100_000),
  mode,
  direction: z.enum(["LR", "TB", "RL", "BT"]).optional(),
  label: z.string().max(200).optional(),
  origin: z.object({ x: z.number(), y: z.number() }).optional(),
});
export type MermaidRequest = z.infer<typeof MermaidRequest>;

export const LayoutRequest = z.object({
  direction,
  groupId: z.string().optional().describe("Only re-layout the children of this group"),
  includePinned: z.boolean().default(false),
  label: z.string().max(200).optional(),
});
export type LayoutRequest = z.infer<typeof LayoutRequest>;

export const BuildResult = z.object({
  seq: z.number().int(),
  batchId: z.string(),
  keyToId: z.record(z.string(), z.string()),
  created: z.number().int(),
  updated: z.number().int(),
  deleted: z.number().int(),
  warnings: z.array(z.string()),
  items: z.array(Item).optional(),
  inverse: z.array(Op).optional().describe("Ops that revert this batch (what the human's Undo applies)"),
});
export type BuildResult = z.infer<typeof BuildResult>;
