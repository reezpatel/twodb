import { z } from "zod";
import { defineAppManifest, defineEndpoint } from "@twodb/core-platform/manifest";

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const backendSummary = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["s3", "local"]),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const virtualStorageSummary = z.object({
  id: z.string(),
  backendId: z.string(),
  name: z.string(),
  prefix: z.string(),
  usage: z.object({ used: z.number(), files: z.number(), folders: z.number() }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const entry = z.object({
  id: z.string(),
  path: z.string(),
  name: z.string(),
  type: z.enum(["file", "folder"]),
  size: z.number(),
  mimeType: z.string().nullable(),
  previewType: z.enum(["image", "video", "audio", "pdf", "text", "archive", "other"]).nullable(),
  deleted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ---------------------------------------------------------------------------
// Backends (S3-compatible or local) — user can register multiple; each shows
// up in the sidebar with its virtual storages as a tree.
// ---------------------------------------------------------------------------

const listBackends = defineEndpoint({
  name: "listBackends",
  method: "GET",
  path: "/backends",
  auth: "session-or-apiKey",
  description: "Lists registered storage backends. Secrets inside config are never returned.",
  response: z.object({
    backends: z.array(backendSummary),
    storages: z.array(virtualStorageSummary),
  }),
});

const createBackend = defineEndpoint({
  name: "createBackend",
  method: "POST",
  path: "/backends",
  auth: "session-or-apiKey",
  description:
    "Registers a storage backend. type 's3' needs {endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle}; " +
    "type 'local' needs {rootPath}. The S3 secret is encrypted at rest. Set test=true to verify reachability before saving " +
    "(the call fails and nothing is stored if the backend is unreachable).",
  request: z.object({
    name: z.string(),
    type: z.enum(["s3", "local"]),
    config: z.record(z.string(), z.unknown()),
    enabled: z.boolean().optional(),
    test: z.boolean().optional(),
  }),
  response: backendSummary,
});

const updateBackend = defineEndpoint({
  name: "updateBackend",
  method: "PATCH",
  path: "/backends/:id",
  auth: "session-or-apiKey",
  description:
    "Updates a backend — rename, enable/disable, or replace config. Omitted config fields keep their current values; " +
    "a present-but-empty secretAccessKey keeps the stored secret.",
  request: z.object({
    id: z.string(),
    name: z.string().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    enabled: z.boolean().optional(),
  }),
  response: backendSummary,
});

const deleteBackend = defineEndpoint({
  name: "deleteBackend",
  method: "DELETE",
  path: "/backends/:id",
  auth: "session-or-apiKey",
  description:
    "Deletes a backend registration. Fails while virtual storages still live on it (delete or move them first). " +
    "Files on the backend itself are never deleted.",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const testBackend = defineEndpoint({
  name: "testBackend",
  method: "POST",
  path: "/backends/:id/test",
  auth: "session-or-apiKey",
  description: "Verifies the backend is reachable (S3 HeadBucket / local stat of the root path).",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.boolean(), error: z.string().optional() }),
});

// ---------------------------------------------------------------------------
// Virtual storages — soft buckets carved out of a backend. Each appears as
// its own entry in the sidebar.
// ---------------------------------------------------------------------------

const createVirtualStorage = defineEndpoint({
  name: "createVirtualStorage",
  method: "POST",
  path: "/storages",
  auth: "session-or-apiKey",
  description:
    "Creates a virtual storage on a backend. `prefix` is its location inside the backend (auto-derived from the name if omitted). " +
    "Optionally marks it as the default virtual storage for app files.",
  request: z.object({
    name: z.string(),
    backendId: z.string(),
    prefix: z.string().optional(),
    setAsDefault: z.boolean().optional(),
  }),
  response: virtualStorageSummary,
});

const updateVirtualStorage = defineEndpoint({
  name: "updateVirtualStorage",
  method: "PATCH",
  path: "/storages/:id",
  auth: "session-or-apiKey",
  description: "Renames a virtual storage (prefix on the backend never moves — existing files keep working).",
  request: z.object({
    id: z.string(),
    name: z.string().optional(),
    setAsDefault: z.boolean().optional(),
  }),
  response: virtualStorageSummary,
});

const deleteVirtualStorage = defineEndpoint({
  name: "deleteVirtualStorage",
  method: "DELETE",
  path: "/storages/:id",
  auth: "session-or-apiKey",
  description:
    "Deletes a virtual storage registration (with confirm=true, hard-deletes its files from the backend too). " +
    "The default-virtual-storage setting is cleared if it pointed here; apps inserting files will error until a new default is set.",
  request: z.object({
    id: z.string(),
    confirm: z.boolean().optional(),
    hardDelete: z.boolean().optional(),
  }),
  response: z.object({ ok: z.boolean() }),
});

const getDefaultStorage = defineEndpoint({
  name: "getDefaultStorage",
  method: "GET",
  path: "/storages/default",
  auth: "session-or-apiKey",
  description:
    "The workspace's default virtual storage — where app folders live when an app has no override. " +
    "Null when none is set (app file APIs return errors in that state).",
  response: z.object({ virtualStorageId: z.string().nullable() }),
});

const setDefaultStorage = defineEndpoint({
  name: "setDefaultStorage",
  method: "PUT",
  path: "/storages/default",
  auth: "session-or-apiKey",
  description: "Sets (or clears, with null) the default virtual storage for app files.",
  request: z.object({ virtualStorageId: z.string().nullable() }),
  response: z.object({ virtualStorageId: z.string().nullable() }),
});

// ---------------------------------------------------------------------------
// Explorer — browse/manage files inside a virtual storage. The central
// entry table is the source of truth.
// ---------------------------------------------------------------------------

const listEntries = defineEndpoint({
  name: "listEntries",
  method: "GET",
  path: "/storages/:storageId/entries",
  auth: "session-or-apiKey",
  description: "Lists direct children of a folder. ?path= selects the folder (root by default); ?trash=true lists trashed entries.",
  request: z.object({ storageId: z.string(), path: z.string().optional(), trash: z.boolean().optional() }),
  response: z.object({ entries: z.array(entry) }),
});

const createFolder = defineEndpoint({
  name: "createFolder",
  method: "POST",
  path: "/storages/:storageId/folders",
  auth: "session-or-apiKey",
  description: "Creates a folder (intermediate folders are created too).",
  request: z.object({ storageId: z.string(), path: z.string() }),
  response: entry,
});

const uploadFile = defineEndpoint({
  name: "uploadFile",
  method: "POST",
  path: "/storages/:storageId/files",
  auth: "session-or-apiKey",
  description:
    "Uploads a file. Raw body (any content type) with ?path=target.ext — the path includes the file name. " +
    "Parent folders are tracked automatically.",
  request: z.object({ storageId: z.string(), path: z.string() }),
  response: entry,
  streaming: false,
});

const downloadFile = defineEndpoint({
  name: "downloadFile",
  method: "GET",
  path: "/storages/:storageId/files/*",
  auth: "session-or-apiKey",
  description: "Downloads a file. ?download=1 forces a download attachment; streams with range support.",
  request: z.object({ storageId: z.string() }),
  response: z.unknown(),
});

const renameEntry = defineEndpoint({
  name: "renameEntry",
  method: "PATCH",
  path: "/storages/:storageId/entries/rename",
  auth: "session-or-apiKey",
  description: "Renames a file or folder within its parent folder.",
  request: z.object({ storageId: z.string(), path: z.string(), newName: z.string() }),
  response: entry,
});

const moveEntry = defineEndpoint({
  name: "moveEntry",
  method: "PATCH",
  path: "/storages/:storageId/entries/move",
  auth: "session-or-apiKey",
  description: "Moves a file or folder to a new path inside the same virtual storage.",
  request: z.object({ storageId: z.string(), from: z.string(), to: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const copyEntry = defineEndpoint({
  name: "copyEntry",
  method: "POST",
  path: "/storages/:storageId/entries/copy",
  auth: "session-or-apiKey",
  description: "Copies a file or folder to a new path inside the same virtual storage.",
  request: z.object({ storageId: z.string(), from: z.string(), to: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const trashEntries = defineEndpoint({
  name: "trashEntries",
  method: "POST",
  path: "/storages/:storageId/entries/trash",
  auth: "session-or-apiKey",
  description: "Moves files/folders to trash (soft delete — restore is possible).",
  request: z.object({ storageId: z.string(), paths: z.array(z.string()) }),
  response: z.object({ ok: z.boolean() }),
});

const restoreEntries = defineEndpoint({
  name: "restoreEntries",
  method: "POST",
  path: "/storages/:storageId/entries/restore",
  auth: "session-or-apiKey",
  description: "Restores trashed entries by id.",
  request: z.object({ storageId: z.string(), entryIds: z.array(z.string()) }),
  response: z.object({ ok: z.boolean() }),
});

const purgeEntries = defineEndpoint({
  name: "purgeEntries",
  method: "POST",
  path: "/storages/:storageId/entries/purge",
  auth: "session-or-apiKey",
  description: "Permanently deletes trashed entries by path from the table and the backend. Irreversible.",
  request: z.object({ storageId: z.string(), paths: z.array(z.string()) }),
  response: z.object({ ok: z.boolean(), deleted: z.number() }),
});

const emptyTrash = defineEndpoint({
  name: "emptyTrash",
  method: "POST",
  path: "/storages/:storageId/trash/empty",
  auth: "session-or-apiKey",
  description: "Permanently deletes everything in this virtual storage's trash.",
  request: z.object({ storageId: z.string() }),
  response: z.object({ ok: z.boolean(), deleted: z.number() }),
});

const searchFiles = defineEndpoint({
  name: "searchFiles",
  method: "GET",
  path: "/storages/:storageId/search",
  auth: "session-or-apiKey",
  description: "Full-tree search by path substring, case-insensitive.",
  request: z.object({ storageId: z.string(), query: z.string(), limit: z.number().optional() }),
  response: z.object({ entries: z.array(entry) }),
});

const recentFiles = defineEndpoint({
  name: "recentFiles",
  method: "GET",
  path: "/storages/:storageId/recent",
  auth: "session-or-apiKey",
  description: "Most recently updated live files in this virtual storage.",
  request: z.object({ storageId: z.string(), limit: z.number().optional() }),
  response: z.object({ entries: z.array(entry) }),
});

// ---------------------------------------------------------------------------
// Share links
// ---------------------------------------------------------------------------

const createShareLink = defineEndpoint({
  name: "createShareLink",
  method: "POST",
  path: "/storages/:storageId/shares",
  auth: "session-or-apiKey",
  description: "Creates a public share link for a file (or a folder — folder shares download as a zip later).",
  request: z.object({
    storageId: z.string(),
    path: z.string(),
    expiresAt: z.string().nullable().optional(),
  }),
  response: z.object({ token: z.string(), url: z.string(), expiresAt: z.string().nullable() }),
});

const listShareLinks = defineEndpoint({
  name: "listShareLinks",
  method: "GET",
  path: "/storages/:storageId/shares",
  auth: "session-or-apiKey",
  description: "Lists active share links for a virtual storage.",
  request: z.object({ storageId: z.string() }),
  response: z.object({
    shares: z.array(
      z.object({
        id: z.string(),
        token: z.string(),
        path: z.string(),
        entryId: z.string(),
        expiresAt: z.string().nullable(),
        createdAt: z.string(),
      }),
    ),
  }),
});

const revokeShareLink = defineEndpoint({
  name: "revokeShareLink",
  method: "DELETE",
  path: "/storages/:storageId/shares/:token",
  auth: "session-or-apiKey",
  description: "Revokes a share link.",
  request: z.object({ storageId: z.string(), token: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const getSharedFile = defineEndpoint({
  name: "getSharedFile",
  method: "GET",
  path: "/shares/:token",
  auth: "public",
  description: "Public (no auth) download of a shared file. 404s when revoked or expired.",
  request: z.object({ token: z.string() }),
  response: z.unknown(),
});

// ---------------------------------------------------------------------------
// Internal app API — called by other apps through the Gateway with their
// friendly identifier in the x-twodb-app header. Each app gets a dedicated
// folder inside the default virtual storage (or its per-app override).
// ---------------------------------------------------------------------------

const appPutFile = defineEndpoint({
  name: "appPutFile",
  method: "PUT",
  path: "/app/objects/*",
  auth: "session-or-apiKey",
  description:
    "Inserts (or overwrites) an object for the calling app. Path is relative to the app's folder inside its virtual " +
    "storage. Requires the x-twodb-app header; errors with 409 no_default_storage when no default virtual storage " +
    "is set and the app has no override.",
  request: z.object({ path: z.string() }),
  response: z.object({
    path: z.string(),
    fullPath: z.string(),
    storageId: z.string(),
    size: z.number(),
  }),
});

const appGetFile = defineEndpoint({
  name: "appGetFile",
  method: "GET",
  path: "/app/objects/*",
  auth: "session-or-apiKey",
  description: "Fetches an object by app-relative path (raw bytes). Requires the x-twodb-app header.",
  request: z.object({ path: z.string() }),
  response: z.unknown(),
});

const appPatchFile = defineEndpoint({
  name: "appPatchFile",
  method: "PATCH",
  path: "/app/objects/*",
  auth: "session-or-apiKey",
  description:
    "Moves/renames an app object. Body: {to: 'new/relative/path'} — relative to the app folder. Requires the x-twodb-app header.",
  request: z.object({ path: z.string(), to: z.string() }),
  response: z.object({ path: z.string(), fullPath: z.string() }),
});

const appDeleteFile = defineEndpoint({
  name: "appDeleteFile",
  method: "DELETE",
  path: "/app/objects/*",
  auth: "session-or-apiKey",
  description: "Trashes an app object by app-relative path. Requires the x-twodb-app header.",
  request: z.object({ path: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const appListFiles = defineEndpoint({
  name: "appListFiles",
  method: "GET",
  path: "/app/objects",
  auth: "session-or-apiKey",
  description:
    "Lists the calling app's folder (recursive, or one level with ?flat=false). Requires the x-twodb-app header.",
  request: z.object({ prefix: z.string().optional(), recursive: z.boolean().optional() }),
  response: z.object({
    entries: z.array(
      z.object({ path: z.string(), type: z.enum(["file", "folder"]), size: z.number(), updatedAt: z.string() }),
    ),
  }),
});

// --- app storage mapping management (settings UI) -------------------------

const listAppOverrides = defineEndpoint({
  name: "listAppOverrides",
  method: "GET",
  path: "/app-overrides",
  auth: "session-or-apiKey",
  description: "Lists per-app virtual storage overrides (app identifier → virtual storage).",
  response: z.object({
    overrides: z.array(
      z.object({ id: z.string(), appId: z.string(), virtualStorageId: z.string(), createdAt: z.string() }),
    ),
  }),
});

const setAppOverride = defineEndpoint({
  name: "setAppOverride",
  method: "PUT",
  path: "/app-overrides/:appId",
  auth: "session-or-apiKey",
  description:
    "Points an app's file folder at a specific virtual storage. With virtualStorageId=null, clears the override " +
    "(the app falls back to the default).",
  request: z.object({ appId: z.string(), virtualStorageId: z.string().nullable() }),
  response: z.object({ ok: z.boolean() }),
});

// ---------------------------------------------------------------------------
// S3-compatible API (simplified auth — see app settings for access keys).
// Mounted per virtual storage under /s3/:storageId, forwarded by the Gateway.
// ---------------------------------------------------------------------------

const listAccessKeys = defineEndpoint({
  name: "listAccessKeys",
  method: "GET",
  path: "/storages/:storageId/keys",
  auth: "session-or-apiKey",
  description: "Lists access keys for a virtual storage's S3-compatible endpoint (secrets never returned).",
  request: z.object({ storageId: z.string() }),
  response: z.object({
    keys: z.array(
      z.object({
        id: z.string(),
        accessKeyId: z.string(),
        label: z.string(),
        createdAt: z.string(),
        lastUsedAt: z.string().nullable(),
      }),
    ),
  }),
});

const createAccessKey = defineEndpoint({
  name: "createAccessKey",
  method: "POST",
  path: "/storages/:storageId/keys",
  auth: "session-or-apiKey",
  description:
    "Creates an access key pair for the S3-compatible endpoint. The secret is returned once, stored only as a hash.",
  request: z.object({ storageId: z.string(), label: z.string().optional() }),
  response: z.object({ id: z.string(), accessKeyId: z.string(), secretAccessKey: z.string(), label: z.string() }),
});

const deleteAccessKey = defineEndpoint({
  name: "deleteAccessKey",
  method: "DELETE",
  path: "/storages/:storageId/keys/:id",
  auth: "session-or-apiKey",
  description: "Deletes an access key (S3 API calls with it start failing immediately).",
  request: z.object({ storageId: z.string(), id: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const s3Api = defineEndpoint({
  name: "s3Api",
  method: "GET",
  path: "/s3/:storageId/*",
  auth: "public",
  description:
    "S3-compatible surface for a virtual storage (GET/HEAD/PUT/DELETE object, GET bucket list-objects). " +
    "Simplified auth: accessKeyId + x-amz-secret (or Authorization: AWS <accessKeyId>:<secret>) headers — no SigV4. " +
    "Paths map directly inside the virtual storage.",
  request: z.object({ storageId: z.string() }),
  response: z.unknown(),
});

// ---------------------------------------------------------------------------

export const manifest = defineAppManifest({
  name: "TwoDrive",
  slug: "twodrive",
  version: "0.1.0",
  shape: "backend+webapp",
  description:
    "Drive/file explorer over multiple storage backends (S3-compatible or local). Virtual storages act as soft " +
    "buckets with an S3-compatible API, plus an internal app-file API with per-app folders.",
  capabilities: ["files", "storage"],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/twodrive",
  endpoints: [
    listBackends,
    createBackend,
    updateBackend,
    deleteBackend,
    testBackend,
    createVirtualStorage,
    updateVirtualStorage,
    deleteVirtualStorage,
    getDefaultStorage,
    setDefaultStorage,
    listEntries,
    createFolder,
    uploadFile,
    downloadFile,
    renameEntry,
    moveEntry,
    copyEntry,
    trashEntries,
    restoreEntries,
    purgeEntries,
    emptyTrash,
    searchFiles,
    recentFiles,
    createShareLink,
    listShareLinks,
    revokeShareLink,
    getSharedFile,
    appPutFile,
    appGetFile,
    appPatchFile,
    appDeleteFile,
    appListFiles,
    listAppOverrides,
    setAppOverride,
    listAccessKeys,
    createAccessKey,
    deleteAccessKey,
    s3Api,
  ],
});

export default manifest;
