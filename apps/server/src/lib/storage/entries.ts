import { db } from "../../auth";
import { pathSegments } from "./driver";

// Tracking-table helpers shared by the org APIs and the admin sync.

export type EntryType = "file" | "folder";

export type PreviewType = "image" | "video" | "audio" | "pdf" | "text" | "archive" | "other";

const TEXT_EXT = new Set([
  ".txt",
  ".md",
  ".json",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".css",
  ".html",
  ".htm",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".sh",
  ".yml",
  ".yaml",
  ".toml",
  ".sql",
  ".csv",
  ".xml",
  ".svg",
  ".log",
]);
const ARCHIVE_EXT = new Set([".zip", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".7z", ".rar"]);

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

async function upsertEntry(organizationId: string, bucketId: string, path: string, type: EntryType, size: number, mimeType: string | null): Promise<boolean> {
  const now = new Date();
  const inserted = await db
    .insertInto("storage_entry")
    .values({
      id: crypto.randomUUID(),
      organizationId,
      bucketId,
      path,
      type,
      size,
      mimeType,
      previewType: type === "file" ? previewTypeFor(mimeType, path) : null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc
        .column("bucketId")
        .column("path")
        .doUpdateSet({
          type,
          ...(type === "file" ? { size, mimeType, previewType: previewTypeFor(mimeType, path) } : {}),
          updatedAt: now,
        }),
    )
    .returning("id")
    .execute();
  return inserted.length > 0;
}

/** Upserts a file entry and every ancestor folder entry. */
export async function trackFile(organizationId: string, bucketId: string, rel: string, size: number, mimeType: string | null) {
  const segments = pathSegments(rel);
  const path = segments.join("/");
  await trackFolderChain(organizationId, bucketId, segments.slice(0, -1));
  await upsertEntry(organizationId, bucketId, path, "file", size, mimeType);
}

/** Upserts folder entries for every prefix of `segments`. */
export async function trackFolderChain(organizationId: string, bucketId: string, segments: string[]): Promise<number> {
  let created = 0;
  let prefix = "";
  for (const segment of segments) {
    prefix = prefix ? `${prefix}/${segment}` : segment;
    if (await upsertEntry(organizationId, bucketId, prefix, "folder", 0, null)) created += 1;
  }
  return created;
}

/** Children of a folder path ('' = root), one level deep. */
export async function listChildren(organizationId: string, bucketId: string, folder: string) {
  const rows = await db
    .selectFrom("storage_entry")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where("bucketId", "=", bucketId)
    .orderBy("type", "desc")
    .orderBy("path", "asc")
    .execute();

  const prefix = folder ? `${folder}/` : "";
  return rows.filter((row) => {
    if (!row.path.startsWith(prefix)) return false;
    const rest = row.path.slice(prefix.length);
    return rest.length > 0 && !rest.includes("/");
  });
}

/** Total bytes of files stored in a bucket. */
export async function bucketUsedBytes(bucketId: string): Promise<number> {
  const [row] = await db
    .selectFrom("storage_entry")
    .select((eb) => eb.fn.sum("size").as("used"))
    .where("bucketId", "=", bucketId)
    .where("type", "=", "file")
    .execute();
  return Number(row?.used ?? 0);
}
