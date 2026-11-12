import { z } from "zod";
import { defineAppManifest, defineEndpoint } from "@twodb/core-platform/manifest";
import { BatchRequest, BatchResult, Board, BoardEvent, CreateBoard, Item, ItemPatch, NewItem } from "./shared/model.js";
import { BuildResult, DiagramRequest, ErdRequest, LayoutRequest, MermaidRequest, ProcessRequest } from "./shared/dto.js";

const id = z.object({ id: z.string().describe("Board id") });
const auth = "session-or-apiKey" as const;

const DocOp = z.discriminatedUnion("op", [
  z.object({ op: z.literal("append"), markdown: z.string() }),
  z.object({ op: z.literal("prepend"), markdown: z.string() }),
  z.object({ op: z.literal("replace_section"), heading: z.string().describe("Heading text (without #)"), markdown: z.string().describe("New section body; the heading line is kept") }),
  z.object({ op: z.literal("replace"), find: z.string(), with: z.string(), all: z.boolean().optional() }),
]);

const listBoards = defineEndpoint({
  name: "listBoards",
  method: "GET",
  path: "/boards",
  auth,
  description: "Lists boards in the caller's workspace (optionally one space). Every workspace member can read and write every board.",
  request: z.object({ spaceId: z.string().optional() }),
  response: z.object({ boards: z.array(Board) }),
});

const createBoard = defineEndpoint({
  name: "createBoard",
  method: "POST",
  path: "/boards",
  auth,
  description:
    'Creates a board. `kind: "diagram"` is a canvas for architecture/AWS/GCP/ERD/flowchart/process diagrams; ' +
    '`kind: "doc"` is a Markdown document whose ```mermaid blocks render as diagrams. `spaceId` defaults to the caller\'s first space.',
  request: CreateBoard,
  response: Board,
});

const getBoard = defineEndpoint({
  name: "getBoard",
  method: "GET",
  path: "/boards/:id",
  auth,
  description: "Returns a board with its current content: all items (diagram) or the markdown + version (doc), plus `seq` for resuming live events.",
  request: id,
  response: z.object({
    board: Board,
    items: z.array(Item),
    doc: z.object({ markdown: z.string(), version: z.number().int() }).nullable(),
  }),
});

const updateBoard = defineEndpoint({
  name: "updateBoard",
  method: "PATCH",
  path: "/boards/:id",
  auth,
  description: "Renames a board or changes its description.",
  request: id.extend({ name: z.string().min(1).max(200).optional(), description: z.string().max(2000).optional() }),
  response: Board,
});

const deleteBoard = defineEndpoint({
  name: "deleteBoard",
  method: "DELETE",
  path: "/boards/:id",
  auth,
  description: "Soft-deletes a board.",
  request: id,
  response: z.object({ ok: z.literal(true) }),
});

const listItems = defineEndpoint({
  name: "listItems",
  method: "GET",
  path: "/boards/:id/items",
  auth,
  description:
    "Lists items of a diagram board. Positions are relative to the parent item (children of groups/lanes move with them). " +
    "Filter with `type` (shape|group|pool|lane|entity|edge|sticky|text|image) or `parentId`.",
  request: id.extend({ type: z.string().optional(), parentId: z.string().optional() }),
  response: z.object({ items: z.array(Item) }),
});

const applyOps = defineEndpoint({
  name: "applyOps",
  method: "POST",
  path: "/boards/:id/ops",
  auth,
  description:
    "Applies a batch of create/update/delete ops in ONE transaction = ONE undo step for the human (`label` is shown to them, e.g. \"AI: added API gateway\"). " +
    "Deleting an item also deletes its children and attached edges. Returns the new state of touched items and `inverse` ops that revert the batch. " +
    "Ops that cannot apply (missing id, version conflict, duplicate key) are reported in `skipped` and the rest still apply.",
  request: id.extend(BatchRequest.shape),
  response: BatchResult,
});

const createItems = defineEndpoint({
  name: "createItems",
  method: "POST",
  path: "/boards/:id/items",
  auth,
  description:
    "Convenience wrapper over /ops: creates items. Item `data` depends on `type` — shape {pack,shape,text,icon,…}, group {kind,title,…}, " +
    "entity {name,columns[]}, edge {from:{itemId,handle?},to:{…},label,kind,cardinality}, sticky {text,color}, text {text}. See GET /catalog for shapes, group kinds and icons.",
  request: id.extend({ items: z.array(NewItem).min(1).max(2000), label: z.string().max(200).optional() }),
  response: BatchResult,
});

const patchItem = defineEndpoint({
  name: "patchItem",
  method: "PATCH",
  path: "/boards/:id/items/:itemId",
  auth,
  description: "Updates one item. `data` is shallow-merged (a null value removes a key). Pass `ifVersion` to guard against concurrent edits.",
  request: id.extend({ itemId: z.string(), ifVersion: z.number().int().optional(), label: z.string().max(200).optional() }).extend(ItemPatch.shape),
  response: BatchResult,
});

const deleteItem = defineEndpoint({
  name: "deleteItem",
  method: "DELETE",
  path: "/boards/:id/items/:itemId",
  auth,
  description: "Deletes one item together with its children and attached edges.",
  request: id.extend({ itemId: z.string() }),
  response: BatchResult,
});

const getEvents = defineEndpoint({
  name: "getEvents",
  method: "GET",
  path: "/boards/:id/events",
  auth,
  description: "Change log of a board (who changed what, with inverse ops). `since` returns events with seq greater than it. The same events stream live over the WebSocket.",
  request: id.extend({ since: z.coerce.number().int().default(0) }),
  response: z.object({ events: z.array(BoardEvent) }),
});

const undoBatch = defineEndpoint({
  name: "undoBatch",
  method: "POST",
  path: "/boards/:id/events/:seq/undo",
  auth,
  description: "Reverts one past batch by applying its stored inverse ops (itself a new, undoable batch). Items edited since may make parts of the undo `skipped`.",
  request: id.extend({ seq: z.coerce.number().int() }),
  response: BatchResult,
});

const buildDiagram = defineEndpoint({
  name: "buildDiagram",
  method: "POST",
  path: "/boards/:id/diagram",
  auth,
  description:
    "PRIMARY AGENT ENDPOINT for architecture, cloud (AWS/GCP), C4 and flowchart diagrams. Describe the graph — nested `groups` (style ids like aws-cloud, aws-vpc, aws-subnet-private, gcp-project, boundary), " +
    "`nodes` (label, icon id or phrase, shape) and `edges` (label, step, kind sync|async|data) — and the server computes positions (ELK layered layout, orthogonal edges, nested containers). " +
    "Items are matched by `key`, so calling again with mode=merge updates/extends the diagram without disturbing parts the human moved by hand. mode=replace wipes the board first.",
  request: id.extend(DiagramRequest.shape),
  response: BuildResult,
});

const buildErd = defineEndpoint({
  name: "buildErd",
  method: "POST",
  path: "/boards/:id/erd",
  auth,
  description:
    "Builds an entity-relationship diagram: `entities` with typed `columns` (pk, fk:\"entity.column\", nullable, unique). Relations are derived from column `fk`s (crow's-foot cardinality inferred from nullable/unique) and can be added explicitly. " +
    "Each column is its own connection point, so relation lines attach to the exact row.",
  request: id.extend(ErdRequest.shape),
  response: BuildResult,
});

const buildProcess = defineEndpoint({
  name: "buildProcess",
  method: "POST",
  path: "/boards/:id/process",
  auth,
  description:
    "Builds a swimlane process map: `lanes`, `steps` (each in a lane, with a flowchart/BPMN shape such as process, decision, terminator, task, start-event, gateway-exclusive) and `flows` between steps. Steps are layered left→right in flow order, inside their lane.",
  request: id.extend(ProcessRequest.shape),
  response: BuildResult,
});

const importMermaid = defineEndpoint({
  name: "importMermaid",
  method: "POST",
  path: "/boards/:id/mermaid",
  auth,
  description:
    "Imports Mermaid source as native, editable items. Supported: `flowchart`/`graph` (shapes, subgraphs, edge labels, dashed/bidirectional links) and `erDiagram`. " +
    "Other Mermaid types are rejected — use /diagram, or write them into a doc board where ```mermaid blocks render as-is.",
  request: id.extend(MermaidRequest.shape),
  response: BuildResult,
});

const relayout = defineEndpoint({
  name: "relayout",
  method: "POST",
  path: "/boards/:id/layout",
  auth,
  description: "Tidy up: re-runs auto-layout over the whole board, or over the children of `groupId`. Hand-placed (pinned) items are kept unless `includePinned`. Swimlane pools are left alone.",
  request: id.extend(LayoutRequest.shape),
  response: BuildResult,
});

const describeBoard = defineEndpoint({
  name: "describeBoard",
  method: "GET",
  path: "/boards/:id/describe",
  auth,
  description: "Compact text outline of a board — groups as a tree, nodes with icons, ERD tables, lanes and connections written as `a --label--> b` — so an agent can read back what is there. Doc boards return their markdown.",
  request: id,
  response: z.object({ text: z.string(), counts: z.record(z.string(), z.number()), seq: z.number().int() }),
});

const getDoc = defineEndpoint({
  name: "getDoc",
  method: "GET",
  path: "/boards/:id/doc",
  auth,
  description: "Returns a doc board's markdown and version.",
  request: id,
  response: z.object({ markdown: z.string(), version: z.number().int() }),
});

const putDoc = defineEndpoint({
  name: "putDoc",
  method: "PUT",
  path: "/boards/:id/doc",
  auth,
  description: "Replaces a doc board's markdown. Pass `ifVersion` to fail with 409 if someone edited since you read it.",
  request: id.extend({ markdown: z.string().max(2_000_000), ifVersion: z.number().int().optional(), label: z.string().max(200).optional() }),
  response: z.object({ version: z.number().int(), seq: z.number().int() }),
});

const patchDoc = defineEndpoint({
  name: "patchDoc",
  method: "PATCH",
  path: "/boards/:id/doc",
  auth,
  description:
    "Edits a doc board in place without resending it: `append`/`prepend`, `replace_section` (by heading text; replaces everything up to the next heading of the same or higher level) or `replace` (find → with). Ops apply in order, atomically.",
  request: id.extend({ ops: z.array(DocOp).min(1), ifVersion: z.number().int().optional(), label: z.string().max(200).optional() }),
  response: z.object({ version: z.number().int(), seq: z.number().int(), markdown: z.string() }),
});

const searchIcons = defineEndpoint({
  name: "searchIcons",
  method: "GET",
  path: "/icons/search",
  auth,
  description:
    "Searches the bundled icon sets: `logos` (tech brands + AWS services, e.g. logos:aws-lambda), `gcp` (Google Cloud products, e.g. gcp:bigquery), `carbon` (generic infrastructure) and `mdi`. Use the returned `id` as a node's `icon`.",
  request: z.object({ q: z.string(), set: z.enum(["logos", "gcp", "carbon", "mdi"]).optional(), limit: z.coerce.number().int().min(1).max(100).default(20) }),
  response: z.object({ icons: z.array(z.object({ id: z.string(), set: z.string(), name: z.string() })) }),
});

const getIcon = defineEndpoint({
  name: "getIcon",
  method: "GET",
  path: "/icons/:set/:name",
  auth,
  description: "Serves one icon as an SVG image (`image/svg+xml`). Optional `color` recolours monochrome icons.",
  request: z.object({ set: z.string(), name: z.string(), color: z.string().optional() }),
});

const getCatalog = defineEndpoint({
  name: "getCatalog",
  method: "GET",
  path: "/catalog",
  auth,
  description: "Everything a client needs to build diagrams: shape packs and shape ids, group styles (AWS/GCP/C4), edge kinds, cardinalities and icon sets.",
  response: z.object({
    shapes: z.array(z.object({ pack: z.string(), id: z.string(), label: z.string(), width: z.number(), height: z.number() })),
    groupStyles: z.array(z.object({ id: z.string(), pack: z.string(), label: z.string(), stroke: z.string(), fill: z.string(), dashed: z.boolean().optional(), icon: z.string().optional() })),
    edgeKinds: z.array(z.string()),
    cardinalities: z.array(z.string()),
    iconSets: z.array(z.object({ prefix: z.string(), name: z.string(), license: z.string() })),
  }),
});

const uploadAsset = defineEndpoint({
  name: "uploadAsset",
  method: "POST",
  path: "/boards/:id/assets",
  auth,
  description: "Uploads an image (multipart/form-data, field `file`, png/jpeg/gif/webp/svg, ≤10 MB) to the board's S3 folder (paintress/{workspaceId}/{boardId}/{assetId}). Place it with an `image` item {assetId}.",
  request: id,
  response: z.object({ id: z.string(), contentType: z.string(), size: z.number(), name: z.string() }),
});

const getAsset = defineEndpoint({
  name: "getAsset",
  method: "GET",
  path: "/assets/:assetId",
  auth,
  description: "Serves an uploaded image (workspace-checked). Streams the bytes.",
  request: z.object({ assetId: z.string() }),
  streaming: true,
});

export const manifest = defineAppManifest({
  name: "Paintress",
  slug: "paintress",
  version: "0.1.0",
  shape: "backend+webapp",
  description:
    "Miro-like boards for diagrams (architecture, AWS/GCP, ERD, flowcharts, swimlane process maps) and Markdown+Mermaid docs. A human edits in the browser while LLM agents edit through the REST API; every change shows up live over a WebSocket.",
  capabilities: ["boards", "diagrams"],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/paintress",
  // GET /boards/:id/ws — live events + human edits (protocol in src/shared/model.ts: ClientMsg/ServerMsg).
  websocketPaths: ["/boards/:id/ws"],
  endpoints: [
    listBoards,
    createBoard,
    getBoard,
    updateBoard,
    deleteBoard,
    listItems,
    applyOps,
    createItems,
    patchItem,
    deleteItem,
    getEvents,
    undoBatch,
    buildDiagram,
    buildErd,
    buildProcess,
    importMermaid,
    relayout,
    describeBoard,
    getDoc,
    putDoc,
    patchDoc,
    searchIcons,
    getIcon,
    getCatalog,
    uploadAsset,
    getAsset,
  ],
});

export default manifest;
