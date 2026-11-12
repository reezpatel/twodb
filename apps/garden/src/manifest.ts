import { z } from "zod";
import { defineAppManifest, defineEndpoint, type EndpointSpec } from "@twodb/core-platform/manifest";
import * as s from "./schemas.js";

const auth = "session-or-apiKey" as const;
const ep = (spec: Omit<EndpointSpec, "auth">) => defineEndpoint({ auth, ...spec });

const endpoints: EndpointSpec[] = [
  ep({
    name: "getTree",
    method: "GET",
    path: "/tree",
    description:
      "Sidebar tree of the active space (header `x-garden-space`, defaults to the caller's first space): top-level pages, sub-pages and databases, plus favorites. Database rows are left out (load them with listChildren). Also returns the id of the space's default \"Notes\" database (All docs).",
    response: z.object({ nodes: z.array(s.treeNode), favorites: z.array(s.treeNode), defaultDatabaseId: z.string() }),
  }),
  ep({
    name: "listChildren",
    method: "GET",
    path: "/records/:id/children",
    description: "Direct children (pages/databases, or a database's rows) of a record, for lazy sidebar expansion.",
    request: s.idParam,
    response: z.object({ nodes: z.array(s.treeNode) }),
  }),
  ep({
    name: "createPage",
    method: "POST",
    path: "/pages",
    description:
      "Creates a page (note). Under a database it becomes a row of that database; anywhere else it lives in the space's default Notes database. Optional `values` sets properties (fieldId → value). `content` is a TipTap JSON doc.",
    request: s.createPage,
    response: s.recordDetail,
  }),
  ep({
    name: "createDatabase",
    method: "POST",
    path: "/databases",
    description: "Creates a database (a real Postgres table) with a Tags field and a Table view. `inline: true` marks it as embedded in its parent page's content.",
    request: s.createDatabase,
    response: z.object({ database: s.recordDetail, fields: z.array(s.field), views: z.array(s.view) }),
  }),
  ep({
    name: "getRecord",
    method: "GET",
    path: "/records/:id",
    description: "A page (content + its database's fields + property values) or a database (metadata). Trashed records stay readable.",
    request: s.idParam,
    response: s.recordDetail,
  }),
  ep({
    name: "updateRecord",
    method: "PATCH",
    path: "/records/:id",
    description:
      "Updates title/icon/cover/content/config/favorite, or moves the record (parentId/position). Moving a page into or out of a database changes the database holding its properties (old properties are dropped).",
    request: s.patchRecord,
    response: s.ok,
  }),
  ep({
    name: "updateValues",
    method: "PATCH",
    path: "/records/:id/values",
    description: "Sets property values of a page (fieldId → value; null clears). `title` is accepted as a key. Two-way relations are kept in sync.",
    request: s.patchValues,
    response: s.recordDetail,
  }),
  ep({ name: "trashRecord", method: "DELETE", path: "/records/:id", description: "Moves a page/database and everything under it to trash.", request: s.idParam, response: s.ok }),
  ep({ name: "restoreRecord", method: "POST", path: "/records/:id/restore", description: "Restores a trashed batch.", request: s.idParam, response: s.ok }),
  ep({
    name: "deleteRecordPermanently",
    method: "DELETE",
    path: "/records/:id/permanent",
    description: "Permanently deletes a trashed record and its subtree (drops database tables).",
    request: s.idParam,
    response: s.ok,
  }),
  ep({
    name: "getBacklinks",
    method: "GET",
    path: "/records/:id/backlinks",
    description: "Pages that mention this record.",
    request: s.idParam,
    response: z.object({ backlinks: z.array(s.recordRef.extend({ snippet: z.string() })) }),
  }),
  ep({
    name: "getDatabase",
    method: "GET",
    path: "/databases/:id",
    description: "Database metadata, fields (system + user, with computed value types) and views.",
    request: s.idParam,
    response: z.object({ database: s.recordDetail, fields: z.array(s.field), views: z.array(s.view) }),
  }),
  ep({
    name: "queryRows",
    method: "POST",
    path: "/databases/:id/query",
    description:
      "Rows of a database. With `viewId` the view's filter/sorts apply; explicit `filter`/`sorts` override them. Every field — incl. rollup and formula — is filterable and sortable (compiled to SQL).",
    request: s.queryRows,
    response: z.object({ rows: z.array(s.row), total: z.number(), relations: z.record(z.string(), s.recordRef) }),
  }),
  ep({
    name: "createField",
    method: "POST",
    path: "/databases/:id/fields",
    description:
      "Adds a field (a column named by its uuid in the database table). Relation: set config.relation.databaseId, `twoWay` creates the reverse field. Rollup: config.rollup. Formula: config.formula.expression, e.g. prop(\"Price\") * prop(\"Qty\").",
    request: s.createField,
    response: s.field,
  }),
  ep({
    name: "updateField",
    method: "PATCH",
    path: "/fields/:id",
    description: "Renames, reconfigures or changes the type of a field. Type changes convert existing values (ALTER through a temp column).",
    request: s.patchField,
    response: s.field,
  }),
  ep({ name: "deleteField", method: "DELETE", path: "/fields/:id", description: "Deletes a field and drops its column.", request: s.idParam, response: s.ok }),
  ep({ name: "createView", method: "POST", path: "/databases/:id/views", description: "Adds a view (table, kanban, list, gallery, calendar).", request: s.createView, response: s.view }),
  ep({ name: "updateView", method: "PATCH", path: "/views/:id", description: "Updates a view's name, type or config (filter, sorts, groupBy, fields…).", request: s.patchView, response: s.view }),
  ep({ name: "duplicateView", method: "POST", path: "/views/:id/duplicate", description: "Duplicates a view.", request: s.idParam, response: s.view }),
  ep({ name: "deleteView", method: "DELETE", path: "/views/:id", description: "Deletes a view (not the last one).", request: s.idParam, response: s.ok }),
  ep({
    name: "search",
    method: "GET",
    path: "/search",
    description: "Full-text search over titles and note content in the active space. `databaseId` limits to that database's rows (relation pickers).",
    request: s.searchQuery,
    response: z.object({ hits: z.array(s.recordRef.extend({ databaseId: z.string().nullable(), parentTitle: z.string().nullable(), snippet: z.string() })) }),
  }),
  ep({
    name: "federatedSearch",
    method: "POST",
    path: "/federated-search",
    capability: "search",
    description: "Gateway federated search: searches notes and databases across all of the caller's spaces.",
    request: z.object({ query: z.string() }),
    response: z.object({
      results: z.array(z.object({ id: z.string(), kind: z.string(), title: z.string(), snippet: z.string(), spaceId: z.string(), url: z.string() })),
    }),
  }),
  ep({
    name: "listTrash",
    method: "GET",
    path: "/trash",
    description: "Trashed pages/databases (batch roots).",
    response: z.object({ items: z.array(s.recordRef.extend({ deletedAt: z.string(), parentTitle: z.string().nullable() })) }),
  }),
  ep({ name: "emptyTrash", method: "DELETE", path: "/trash", description: "Permanently deletes everything in trash.", response: s.ok }),
  ep({
    name: "uploadAsset",
    method: "POST",
    path: "/assets",
    description: "Uploads an image (raw body, image/* content type, ≤10 MB; optional `x-file-name` header and `recordId` query). Returns its URL.",
    request: z.object({ recordId: s.uuid.optional() }),
    response: z.object({ id: z.string(), url: z.string() }),
  }),
  ep({ name: "getAsset", method: "GET", path: "/assets/:id", description: "Serves an uploaded image (workspace-checked).", request: s.idParam }),
];

export const manifest = defineAppManifest({
  name: "Garden",
  slug: "garden",
  version: "0.1.0",
  shape: "backend+webapp",
  description:
    "Knowledge base: nested notes with a block editor (TipTap) and Notion-style databases backed by real Postgres tables — table/kanban/list/gallery/calendar views, filters, sorts, relations, rollups and formulas.",
  capabilities: ["search"],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/garden",
  endpoints,
});

export default manifest;
