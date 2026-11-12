import { ulid } from "ulid";
import { createHash } from "node:crypto";
import type { Kysely } from "@twodb/core-data/db";
import type { TwoDriveDb, VirtualStorageRow, EntryRow } from "../db/schema.js";
import type { StorageDriver } from "../storage/driver.js";
import { getStorageDriver } from "../storage/registry.js";
import { pathSegments, joinPath } from "../storage/driver.js";

// ---------------------------------------------------------------------------
// The store: every operation resolves a virtual storage, maps its prefix onto
// the backend driver, and keeps drive_entry (the central table — source of
// truth) in sync. Folder rows are tracked eagerly (ancestor chain), exactly
// like the legacy entries.ts.
// ---------------------------------------------------------------------------

const TEXT_EXT = new Set([
  ".txt", ".md", ".json", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".html", ".htm",
  ".py", ".rs", ".go", ".java", ".sh", ".yml", ".yaml", ".toml", ".sql", ".csv", ".xml", ".svg", ".log",
]);
const ARCHIVE_EXT = new Set([".zip", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".7z", ".rar"]);

export type PreviewType = "image" | "video" | "audio" | "pdf" | "text" | "archive" | "other";

export function previewTypeFor(mimeType: string | null, path: string): PreviewType {
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType?.startsWith("video/")) return "video";
  if (mimeType?.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType?.startsWith("text/") || mimeType === "application/json") return "text";
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot).toLowerCase() : "";
  if (TEXT_EXT.has(ext)) return "text";
  if (ARCHIVE_EXT.has(ext)) return "archive";
  return "other";
}

/** Normalizes + validates a user/app-supplied path. Root ("") allowed. */
export function normalizePath(rel: string): string {
  return pathSegments(rel).join("/");
}

export { joinPath };

export interface ResolvedVirtualStorage {
  vs: VirtualStorageRow;
  driver: StorageDriver;
  backendType: string;
}

export async function resolveVirtualStorage(
  db: Kysely<TwoDriveDb>,
  workspaceId: string,
  vsRef: string,
  dataKey: string,
): Promise<ResolvedVirtualStorage> {
  const vs = await db
    .selectFrom("drive_virtual_storage")
    .selectAll()
    .where("workspace_id", "=", workspaceId)
    .where((eb) => eb("id", "=", vsRef).or("name", "=", vsRef))
    .executeTakeFirst();
  if (!vs) throw new Error("virtual storage not found");
  const { backend, driver } = await getStorageDriver(db, workspaceId, vs.backend_id, dataKey);
  return { vs, driver, backendType: backend.type };
}

/** Backend-absolute key for an entry path inside a virtual storage. */
export function backendKey(vs: VirtualStorageRow, path: string): string {
  return joinPath(vs.prefix, path);
}

// --- entry tracking ---------------------------------------------------------

async function upsertEntry(
  db: Kysely<TwoDriveDb>,
  workspaceId: string,
  vsId: string,
  path: string,
  type: "file" | "folder",
  size: number,
  mimeType: string | null,
  etag: string | null,
): Promise<string> {
  const now = new Date().toISOString();
  const existing = await db
    .selectFrom("drive_entry")
    .select("id")
    .where("virtual_storage_id", "=", vsId)
    .where("path", "=", path)
    .executeTakeFirst();

  if (existing) {
    // If the entry is trashed, re-creating a live entry at that path revives it.
    await db
      .updateTable("drive_entry")
      .set({
        type,
        size: BigInt(size),
        mime_type: type === "file" ? mimeType : null,
        preview_type: type === "file" ? previewTypeFor(mimeType, path) : null,
        etag,
        deleted_at: null,
        original_path: null,
        updated_at: now,
      })
      .where("id", "=", existing.id)
      .execute();
    return existing.id;
  }

  const id = ulid();
  await db
    .insertInto("drive_entry")
    .values({
      id,
      workspace_id: workspaceId,
      virtual_storage_id: vsId,
      path,
      type,
      size: BigInt(size),
      mime_type: type === "file" ? mimeType : null,
      preview_type: type === "file" ? previewTypeFor(mimeType, path) : null,
      etag,
      created_at: now,
      updated_at: now,
    })
    .execute();
  return id;
}

/** Upserts folder entries for every prefix of `segments`. */
async function trackFolderChain(db: Kysely<TwoDriveDb>, workspaceId: string, vsId: string, segments: string[]): Promise<void> {
  let prefix = "";
  for (const segment of segments) {
    prefix = prefix ? `${prefix}/${segment}` : segment;
    await upsertEntry(db, workspaceId, vsId, prefix, "folder", 0, null, null);
  }
}

/** Upserts a file entry and every ancestor folder entry. */
async function trackFile(
  db: Kysely<TwoDriveDb>,
  workspaceId: string,
  vsId: string,
  rel: string,
  size: number,
  mimeType: string | null,
  etag: string | null,
): Promise<string> {
  const segments = pathSegments(rel);
  const path = segments.join("/");
  await trackFolderChain(db, workspaceId, vsId, segments.slice(0, -1));
  return upsertEntry(db, workspaceId, vsId, path, "file", size, mimeType, etag);
}

async function getEntry(db: Kysely<TwoDriveDb>, vsId: string, path: string): Promise<EntryRow | undefined> {
  return db
    .selectFrom("drive_entry")
    .selectAll()
    .where("virtual_storage_id", "=", vsId)
    .where("path", "=", path)
    .executeTakeFirst();
}

// --- public operations ------------------------------------------------------

export interface PutFileOptions {
  mimeType?: string;
  /** Skip ancestor-folder tracking when the caller already did it. */
  skipFolders?: boolean;
}

export async function putFile(
  db: Kysely<TwoDriveDb>,
  workspaceId: string,
  resolved: ResolvedVirtualStorage,
  path: string,
  data: Buffer,
  opts: PutFileOptions = {},
): Promise<EntryRow> {
  const clean = normalizePath(path);
  if (!clean) throw new Error("file path required");
  const mimeType = opts.mimeType ?? guessMime(clean);
  await resolved.driver.put(backendKey(resolved.vs, clean), data, mimeType);
  const etag = createHash("sha256").update(data).digest("hex").slice(0, 32);
  const id = await trackFile(db, workspaceId, resolved.vs.id, clean, data.length, mimeType, etag);
  const entry = await getEntry(db, resolved.vs.id, clean);
  if (!entry) throw new Error("entry disappeared after upsert");
  return entry;
}

export async function getFile(
  db: Kysely<TwoDriveDb>,
  resolved: ResolvedVirtualStorage,
  path: string,
  { includeTrashed = false }: { includeTrashed?: boolean } = {},
): Promise<{ entry: EntryRow; body: Buffer; contentType?: string }> {
  const clean = normalizePath(path);
  const entry = await getEntry(db, resolved.vs.id, clean);
  if (!entry || entry.type !== "file") throw new Error("file not found");
  if (entry.deleted_at && !includeTrashed) throw new Error("file not found");
  const res = await resolved.driver.get(backendKey(resolved.vs, clean));
  return { entry, body: res.body, contentType: res.contentType ?? entry.mime_type ?? "application/octet-stream" };
}

export async function mkdir(
  db: Kysely<TwoDriveDb>,
  workspaceId: string,
  resolved: ResolvedVirtualStorage,
  path: string,
): Promise<EntryRow> {
  const clean = normalizePath(path);
  if (!clean) throw new Error("folder path required");
  const segments = pathSegments(clean);
  await trackFolderChain(db, workspaceId, resolved.vs.id, segments);
  if (resolved.driver.mkdir) await resolved.driver.mkdir(backendKey(resolved.vs, clean));
  const entry = await getEntry(db, resolved.vs.id, clean);
  if (!entry) throw new Error("entry disappeared after upsert");
  return entry;
}

export interface ListOptions {
  path?: string;
  includeTrashed?: boolean;
}

/** Lists direct children of a folder (one level, like the legacy listing). */
export async function listFolder(
  db: Kysely<TwoDriveDb>,
  resolved: ResolvedVirtualStorage,
  opts: ListOptions = {},
): Promise<EntryRow[]> {
  const folder = normalizePath(opts.path ?? "");
  const like = folder ? `${folder}/%` : "%";

  let qb = db
    .selectFrom("drive_entry")
    .selectAll()
    .where("virtual_storage_id", "=", resolved.vs.id)
    .where("path", "like", like);
  qb = opts.includeTrashed ? qb.where("deleted_at", "is not", null) : qb.where("deleted_at", "is", null);
  const rows = await qb.execute();

  const depth = folder ? folder.split("/").length : 0;
  const out: EntryRow[] = [];
  for (const row of rows) {
    // Direct children only (one level under the folder).
    if (row.path.split("/").length !== depth + 1) continue;
    out.push(row);
  }
  return out;
}

export async function trashEntry(db: Kysely<TwoDriveDb>, resolved: ResolvedVirtualStorage, path: string): Promise<void> {
  const clean = normalizePath(path);
  const entry = await getEntry(db, resolved.vs.id, clean);
  if (!entry) throw new Error("entry not found");
  const now = new Date().toISOString();
  if (entry.type === "folder") {
    // Trash every descendant too, keeping each row's original path intact
    // for restore purposes.
    await db
      .updateTable("drive_entry")
      .set({ deleted_at: now, original_path: null })
      .where("virtual_storage_id", "=", resolved.vs.id)
      .where("path", "like", `${clean}/%`)
      .execute();
    await db
      .updateTable("drive_entry")
      .set({ deleted_at: now, original_path: entry.path })
      .where("id", "=", entry.id)
      .execute();
  } else {
    await db
      .updateTable("drive_entry")
      .set({ deleted_at: now, original_path: entry.path })
      .where("id", "=", entry.id)
      .execute();
  }
}

export async function restoreEntry(db: Kysely<TwoDriveDb>, resolved: ResolvedVirtualStorage, entryId: string): Promise<void> {
  const entry = await db
    .selectFrom("drive_entry")
    .selectAll()
    .where("id", "=", entryId)
    .executeTakeFirst();
  if (!entry || !entry.deleted_at) throw new Error("trashed entry not found");

  // Folder restore: only restore descendants that were trashed together with
  // it (same deleted_at) — a descendant trashed earlier stays trashed.
  if (entry.type === "folder") {
    await db
      .updateTable("drive_entry")
      .set({ deleted_at: null, original_path: null })
      .where("virtual_storage_id", "=", resolved.vs.id)
      .where("path", "like", `${entry.original_path ?? entry.path}/%`)
      .where("deleted_at", "=", entry.deleted_at)
      .execute();
  }
  await db
    .updateTable("drive_entry")
    .set({ deleted_at: null, original_path: null, updated_at: new Date().toISOString() })
    .where("id", "=", entry.id)
    .execute();
}

/** Hard-deletes an entry (trashed or not) from table + backend. */
export async function purgeEntry(db: Kysely<TwoDriveDb>, resolved: ResolvedVirtualStorage, path: string): Promise<number> {
  const clean = normalizePath(path);
  const entry = await getEntry(db, resolved.vs.id, clean);
  if (!entry) return 0;
  let count = 1;
  if (entry.type === "folder") {
    const descendants = await db
      .selectFrom("drive_entry")
      .select("id")
      .where("virtual_storage_id", "=", resolved.vs.id)
      .where("path", "like", `${clean}/%`)
      .execute();
    count = descendants.length + 1;
    await resolved.driver.delPrefix(backendKey(resolved.vs, clean));
  } else {
    await resolved.driver.del(backendKey(resolved.vs, clean));
  }
  // Delete the entry and all descendants from the table.
  await db
    .deleteFrom("drive_entry")
    .where("virtual_storage_id", "=", resolved.vs.id)
    .where((eb) => eb("path", "=", clean).or("path", "like", `${clean}/%`))
    .execute();
  return count;
}

/** Permanently empties the trash of a virtual storage. */
export async function emptyTrash(db: Kysely<TwoDriveDb>, resolved: ResolvedVirtualStorage): Promise<number> {
  const trashed = await db
    .selectFrom("drive_entry")
    .select(["id", "path", "type", "original_path"])
    .where("virtual_storage_id", "=", resolved.vs.id)
    .where("deleted_at", "is not", null)
    .execute();
  let count = 0;
  // Folders first (depth order not needed — purgeEntry handles descendants),
  // but skip descendants already removed by their parent's purge.
  const handled = new Set<string>();
  for (const row of trashed) {
    const path = row.original_path ?? row.path;
    if (handled.has(path)) continue;
    handled.add(path);
    count += await purgeEntry(db, resolved, path);
  }
  return count;
}

export async function moveEntry(
  db: Kysely<TwoDriveDb>,
  workspaceId: string,
  resolved: ResolvedVirtualStorage,
  from: string,
  to: string,
): Promise<void> {
  const fromClean = normalizePath(from);
  const toClean = normalizePath(to);
  if (!fromClean || !toClean) throw new Error("source and destination required");
  if (fromClean === toClean) return;
  if (toClean.startsWith(`${fromClean}/`)) throw new Error("cannot move a folder into itself");

  const entry = await getEntry(db, resolved.vs.id, fromClean);
  if (!entry || entry.deleted_at) throw new Error("entry not found");

  const destExisting = await getEntry(db, resolved.vs.id, toClean);
  if (destExisting && !destExisting.deleted_at) throw new Error("destination already exists");

  const { body, contentType } = await getFile(db, resolved, fromClean, { includeTrashed: false }).catch(async () => {
    throw new Error("entry not found");
  });

  if (entry.type === "file") {
    await resolved.driver.put(backendKey(resolved.vs, toClean), body, contentType ?? undefined);
    await resolved.driver.del(backendKey(resolved.vs, fromClean));
    await db
      .updateTable("drive_entry")
      .set({ path: toClean, preview_type: previewTypeFor(entry.mime_type, toClean), updated_at: new Date().toISOString() })
      .where("id", "=", entry.id)
      .execute();
    // Destination side of the tree gets folder rows.
    await trackFolderChain(db, workspaceId, resolved.vs.id, toClean.split("/").slice(0, -1));
  } else {
    // Folder move: copy every descendant to the new prefix, then delete old.
    const descendants = await db
      .selectFrom("drive_entry")
      .selectAll()
      .where("virtual_storage_id", "=", resolved.vs.id)
      .where("path", "like", `${fromClean}/%`)
      .execute();
    for (const desc of descendants) {
      if (desc.type !== "file") continue;
      const res = await resolved.driver.get(backendKey(resolved.vs, desc.path));
      await resolved.driver.put(
        backendKey(resolved.vs, `${toClean}/${desc.path.slice(fromClean.length + 1)}`),
        res.body,
        desc.mime_type ?? undefined,
      );
    }
    await resolved.driver.delPrefix(backendKey(resolved.vs, fromClean));
    // Update table rows: the folder itself + descendants get the new prefix.
    const rows = [entry, ...descendants];
    for (const row of rows) {
      const newPath = row.path === fromClean ? toClean : `${toClean}/${row.path.slice(fromClean.length + 1)}`;
      await db
        .updateTable("drive_entry")
        .set({ path: newPath, updated_at: new Date().toISOString() })
        .where("id", "=", row.id)
        .execute();
    }
    await trackFolderChain(db, workspaceId, resolved.vs.id, toClean.split("/").slice(0, -1));
  }
}

export async function copyEntry(
  db: Kysely<TwoDriveDb>,
  workspaceId: string,
  resolved: ResolvedVirtualStorage,
  from: string,
  to: string,
): Promise<void> {
  const fromClean = normalizePath(from);
  const toClean = normalizePath(to);
  if (!fromClean || !toClean) throw new Error("source and destination required");
  if (fromClean === toClean) throw new Error("source and destination are identical");
  if (toClean.startsWith(`${fromClean}/`)) throw new Error("cannot copy a folder into itself");

  const entry = await getEntry(db, resolved.vs.id, fromClean);
  if (!entry || entry.deleted_at) throw new Error("entry not found");
  const destExisting = await getEntry(db, resolved.vs.id, toClean);
  if (destExisting && !destExisting.deleted_at) throw new Error("destination already exists");

  if (entry.type === "file") {
    const { body, contentType } = await getFile(db, resolved, fromClean);
    await putFile(db, workspaceId, resolved, toClean, body, { mimeType: contentType });
  } else {
    const descendants = await db
      .selectFrom("drive_entry")
      .selectAll()
      .where("virtual_storage_id", "=", resolved.vs.id)
      .where("path", "like", `${fromClean}/%`)
      .execute();
    await mkdir(db, workspaceId, resolved, toClean).catch(() => undefined);
    for (const desc of descendants) {
      if (desc.type !== "file") continue;
      const res = await resolved.driver.get(backendKey(resolved.vs, desc.path));
      await putFile(db, workspaceId, resolved, `${toClean}/${desc.path.slice(fromClean.length + 1)}`, res.body, {
        mimeType: desc.mime_type ?? undefined,
      });
    }
  }
}

export async function renameEntry(
  db: Kysely<TwoDriveDb>,
  workspaceId: string,
  resolved: ResolvedVirtualStorage,
  path: string,
  newName: string,
): Promise<void> {
  const clean = normalizePath(path);
  const segments = clean.split("/");
  const parent = segments.slice(0, -1).join("/");
  const dest = joinPath(parent, newName);
  return moveEntry(db, workspaceId, resolved, clean, dest);
}

export interface SearchOptions {
  query: string;
  limit?: number;
}

/** Full-tree search under a virtual storage (path substring, case-insensitive). */
export async function searchEntries(
  db: Kysely<TwoDriveDb>,
  resolved: ResolvedVirtualStorage,
  opts: SearchOptions,
): Promise<EntryRow[]> {
  const q = opts.query.toLowerCase();
  const rows = await db
    .selectFrom("drive_entry")
    .selectAll()
    .where("virtual_storage_id", "=", resolved.vs.id)
    .where("deleted_at", "is", null)
    .execute();
  return rows
    .filter((r) => r.path.toLowerCase().includes(q))
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, opts.limit ?? 200);
}

/** Byte usage of a virtual storage (live files only). */
export async function usageOf(db: Kysely<TwoDriveDb>, vsId: string): Promise<{ used: number; files: number; folders: number }> {
  const rows = await db
    .selectFrom("drive_entry")
    .select(["type", "size"])
    .where("virtual_storage_id", "=", vsId)
    .where("deleted_at", "is", null)
    .execute();
  let used = 0;
  let files = 0;
  let folders = 0;
  for (const row of rows) {
    if (row.type === "folder") folders += 1;
    else {
      files += 1;
      used += Number(row.size);
    }
  }
  return { used, files, folders };
}

function guessMime(path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const map: Record<string, string> = {
    txt: "text/plain", md: "text/markdown", json: "application/json", csv: "text/csv",
    html: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    pdf: "application/pdf", zip: "application/zip", gz: "application/gzip", tar: "application/x-tar",
    mp3: "audio/mpeg", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  };
  return map[ext] ?? "application/octet-stream";
}
