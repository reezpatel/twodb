import { db } from "../auth";
import { getStorageDestinations } from "./server-settings";
import { getStorageDriver } from "./storage/registry";
import { logger } from "./logger";

// Chat assets: files uploaded from the composer land in the agent_assets
// storage destination (backend + prefix from server settings) and are
// referenced everywhere as twodb://<backendId>/<mediaId>.

export const TWOODB_URI_RE = /^twodb:\/\/([A-Za-z0-9-_.]+)\/([A-Za-z0-9-_.]+)$/;

export interface StoredAsset {
  id: string;
  backendId: string;
  path: string;
  filename: string;
  extension: string;
  contentType: string | null;
  size: number;
  uri: string;
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 && dot < filename.length - 1 ? filename.slice(dot + 1).toLowerCase() : "";
}

export type DestinationId = "agent_assets" | "chat_assets";

/** Driver for a configured storage destination — throws when unset. */
async function destinationDriver(destinationId: DestinationId): Promise<{ backendId: string; prefix: string; driver: Awaited<ReturnType<typeof getStorageDriver>>["driver"] }> {
  const destination = (await getStorageDestinations())[destinationId];
  if (!destination) throw new Error(`${destinationId}_not_configured`);
  const { backend, driver } = await getStorageDriver(destination.backendId);
  return { backendId: backend.id, prefix: destination.prefix, driver };
}

/** Driver for the configured agent_assets destination — throws when unset. */
async function assetsDriver(): Promise<{ backendId: string; prefix: string; driver: Awaited<ReturnType<typeof getStorageDriver>>["driver"] }> {
  return destinationDriver("agent_assets");
}

export interface StoreAssetInput {
  organizationId: string;
  filename: string;
  contentType: string | null;
  data: Buffer;
  /** agent_assets sessions — media_asset.sessionId. */
  sessionId?: string | null;
  /** chat_assets channels — media_asset.chatChannelId. */
  chatChannelId?: string | null;
}

/** Stores bytes under a storage destination and records the media_asset row. */
async function storeAssetAt(destinationId: DestinationId, input: StoreAssetInput): Promise<StoredAsset> {
  const { backendId, prefix, driver } = await destinationDriver(destinationId);
  const id = crypto.randomUUID();
  const extension = extensionOf(input.filename);
  const path = [prefix, `${id}${extension ? `.${extension}` : ""}`].filter(Boolean).join("/");
  try {
    await driver.put(path, input.data, input.contentType ?? undefined);
  } catch (e) {
    logger.error({ destinationId, backendId, path, err: e, size: input.data.length }, "asset store failed");
    throw e;
  }

  await db
    .insertInto("media_asset")
    .values({
      id,
      organizationId: input.organizationId,
      sessionId: input.sessionId ?? null,
      chatChannelId: input.chatChannelId ?? null,
      backendId,
      path,
      filename: input.filename,
      extension,
      contentType: input.contentType,
      size: input.data.length,
      createdAt: new Date(),
    })
    .execute();

  logger.info({ mediaId: id, destinationId, backendId, filename: input.filename, size: input.data.length }, "asset stored");

  return {
    id,
    backendId,
    path,
    filename: input.filename,
    extension,
    contentType: input.contentType,
    size: input.data.length,
    uri: `twodb://${backendId}/${id}`,
  };
}

export async function storeAsset(input: {
  organizationId: string;
  sessionId: string | null;
  filename: string;
  contentType: string | null;
  data: Buffer;
}): Promise<StoredAsset> {
  return storeAssetAt("agent_assets", input);
}

/** Chat attachment upload — lands in the chat_assets destination, bound to the channel. */
export async function storeChatAsset(input: {
  organizationId: string;
  chatChannelId: string;
  filename: string;
  contentType: string | null;
  data: Buffer;
}): Promise<StoredAsset> {
  return storeAssetAt("chat_assets", input);
}

/** Parses a twodb:// uri into its backend + media id. */
export function parseAssetUri(uri: string): { backendId: string; mediaId: string } | null {
  const match = TWOODB_URI_RE.exec(uri.trim());
  return match ? { backendId: match[1], mediaId: match[2] } : null;
}

async function loadAsset(organizationId: string, uri: string) {
  const ref = parseAssetUri(uri);
  if (!ref) throw new Error("invalid_asset_uri");
  const row = await db.selectFrom("media_asset").selectAll().where("id", "=", ref.mediaId).where("organizationId", "=", organizationId).executeTakeFirst();
  if (!row) throw new Error("asset_not_found");
  const { driver } = await getStorageDriver(row.backendId);
  return { row, driver };
}

/** Bytes by media id — for preview/download endpoints (org-scoped). */
export async function readAssetBytesById(organizationId: string, mediaId: string): Promise<{ filename: string; contentType: string; body: Buffer }> {
  const row = await db.selectFrom("media_asset").selectAll().where("id", "=", mediaId).where("organizationId", "=", organizationId).executeTakeFirst();
  if (!row) throw new Error("asset_not_found");
  const { driver } = await getStorageDriver(row.backendId);
  const got = await driver.get(row.path);
  return { filename: row.filename, contentType: got.contentType ?? row.contentType ?? "application/octet-stream", body: got.body };
}

/** Base64 image bytes for vision-capable rounds — null for non-images. */
export async function resolveImageBase64(organizationId: string, uri: string): Promise<{ filename: string; contentType: string; base64: string } | null> {
  const { row, driver } = await loadAsset(organizationId, uri);
  if (!row.contentType?.startsWith("image/")) return null;
  const got = await driver.get(row.path);
  return { filename: row.filename, contentType: row.contentType, base64: got.body.toString("base64") };
}

const TEXTY_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "jsonc",
  "yaml",
  "yml",
  "toml",
  "csv",
  "tsv",
  "env",
  "ini",
  "cfg",
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "c",
  "h",
  "cpp",
  "hpp",
  "cs",
  "php",
  "sh",
  "bash",
  "zsh",
  "sql",
  "html",
  "htm",
  "css",
  "scss",
  "xml",
  "svg",
  "graphql",
  "prisma",
]);

const READ_ASSET_MAX_CHARS = 20_000;
/** Providers cap image payloads (Anthropic: 5 MB) — stay safely under. */
export const MAX_IMAGE_BASE64 = 4_500_000;

export interface AssetImagePart {
  filename: string;
  contentType: string;
  base64: string;
}

/** read_asset tool output — compact header + decoded text; images come back as parts for vision models. */
export async function readAssetForModel(
  organizationId: string,
  uri: string,
  supportsImages = false,
  imageToolResults = false,
): Promise<{ output: string; filename: string; backendId: string; path: string; imagePart?: AssetImagePart }> {
  const { row, driver } = await loadAsset(organizationId, uri);
  const header = `read ${row.filename} from ${row.backendId} at ${row.path}`;
  const isImage = row.contentType?.startsWith("image/") ?? false;
  const texty = (row.contentType?.startsWith("text/") || row.contentType === "application/json" || TEXTY_EXTENSIONS.has(row.extension)) ?? false;
  if (!texty) {
    // Vision models get the actual image bytes (Anthropic renders them inside
    // the tool result); otherwise all we can give is metadata.
    let imagePart: AssetImagePart | undefined;
    if (isImage && supportsImages && imageToolResults) {
      const got = await driver.get(row.path);
      const base64 = got.body.toString("base64");
      if (base64.length <= MAX_IMAGE_BASE64) imagePart = { filename: row.filename, contentType: row.contentType!, base64 };
    }
    const kind = isImage ? "image asset" : "binary asset";
    const note = imagePart
      ? "(image attached below)"
      : isImage && supportsImages && !imageToolResults
        ? "(the image is attached to the conversation above — you can see it directly)"
        : isImage && supportsImages
          ? "(image too large to inline — ask the user to attach a smaller version)"
          : isImage
            ? "(this model has no image input — you cannot view pictures; ask the user to describe it or switch to a vision-capable model)"
            : `(${row.contentType ?? "unknown type"}, ${row.size} bytes)`;
    return { output: `${header}\n\n${kind}: ${row.filename} ${note}`, filename: row.filename, backendId: row.backendId, path: row.path, imagePart };
  }
  const got = await driver.get(row.path);
  const text = got.body.toString("utf8");
  return {
    output:
      text.length > READ_ASSET_MAX_CHARS
        ? `${header}\n\n${text.slice(0, READ_ASSET_MAX_CHARS)}\n\n[…truncated, ${text.length - READ_ASSET_MAX_CHARS} more characters]`
        : `${header}\n\n${text}`,
    filename: row.filename,
    backendId: row.backendId,
    path: row.path,
  };
}
