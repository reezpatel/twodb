import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { db } from "../../auth";
import { destinationDriver } from "../assets";
import { getStorageDriver } from "../storage/registry";
import { logger } from "../logger";

// Email bytes (attachments + raw .eml.gz) live in the email_attachments
// storage destination as media_asset rows. Identical bytes within an org are
// stored once (sha256) and released only when nothing references them.

export class EmailStorageNotConfigured extends Error {
  constructor() {
    super("email_attachments_not_configured");
  }
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 && dot < filename.length - 1 ? filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) : "";
}

export async function emailStorageReady(): Promise<boolean> {
  try {
    await destinationDriver("email_attachments");
    return true;
  } catch {
    return false;
  }
}

export async function storeEmailBytes(input: {
  organizationId: string;
  accountId: string;
  filename: string;
  contentType: string | null;
  data: Buffer;
  raw?: boolean;
}): Promise<string> {
  const sha256 = createHash("sha256").update(input.data).digest("hex");
  const existing = await db
    .selectFrom("media_asset")
    .select("id")
    .where("organizationId", "=", input.organizationId)
    .where("sha256", "=", sha256)
    .executeTakeFirst();
  if (existing) return existing.id;

  let target: Awaited<ReturnType<typeof destinationDriver>>;
  try {
    target = await destinationDriver("email_attachments");
  } catch {
    throw new EmailStorageNotConfigured();
  }
  const id = crypto.randomUUID();
  const now = new Date();
  const body = input.raw ? gzipSync(input.data) : input.data;
  const extension = input.raw ? "eml.gz" : extensionOf(input.filename);
  const folder = input.raw ? "raw" : `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const path = [target.prefix, input.accountId, folder, `${id}${extension ? `.${extension}` : ""}`].filter(Boolean).join("/");
  await target.driver.put(path, body, input.raw ? "application/gzip" : (input.contentType ?? undefined));
  await db
    .insertInto("media_asset")
    .values({
      id,
      organizationId: input.organizationId,
      sessionId: null,
      chatChannelId: null,
      backendId: target.backendId,
      path,
      filename: input.filename,
      extension,
      contentType: input.raw ? "message/rfc822" : input.contentType,
      size: input.data.length,
      sha256,
      createdAt: now,
    })
    .execute();
  return id;
}

export async function readEmailMedia(organizationId: string, mediaId: string): Promise<{ body: Buffer; filename: string; contentType: string }> {
  const row = await db.selectFrom("media_asset").selectAll().where("id", "=", mediaId).where("organizationId", "=", organizationId).executeTakeFirst();
  if (!row) throw new Error("asset_not_found");
  const { driver } = await getStorageDriver(row.backendId);
  const got = await driver.get(row.path);
  const body = row.extension === "eml.gz" ? gunzipSync(got.body) : got.body;
  return { body, filename: row.filename, contentType: row.contentType ?? got.contentType ?? "application/octet-stream" };
}

/** Deletes media no longer referenced by any attachment or raw message. */
export async function releaseEmailMedia(mediaIds: (string | null | undefined)[]) {
  for (const id of new Set(mediaIds.filter((v): v is string => !!v))) {
    const attachmentRef = await db.selectFrom("email_attachment").select("id").where("mediaId", "=", id).limit(1).executeTakeFirst();
    const rawRef = await db
      .selectFrom("email_message")
      .select("id")
      .where("rawMediaId", "=", id)
      .where("purgedAt", "is", null)
      .limit(1)
      .executeTakeFirst();
    if (attachmentRef || rawRef) continue;
    const row = await db.selectFrom("media_asset").selectAll().where("id", "=", id).executeTakeFirst();
    if (!row) continue;
    try {
      const { driver } = await getStorageDriver(row.backendId);
      await driver.del(row.path);
    } catch (e) {
      logger.warn({ err: e, mediaId: id }, "email: media delete failed");
    }
    await db.deleteFrom("media_asset").where("id", "=", id).execute();
  }
}
