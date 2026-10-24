import { sql } from "kysely";
import { db } from "../auth";
import { logger } from "./logger";
import { SHARED_CONTENT_LOCK, SHARED_CONTENT_PROPS, type SharedContentStatus } from "./shared-content";
import { notesTable, updateRowProps } from "./notes-tables";

/** Background processing for shared_content rows with status "pending".
 *
 * Only Instagram reel (/reel/<id>) and post (/p/<id>) URLs are handled:
 * the page is fetched, media URLs are extracted into the `medias` prop
 * (JSON.stringify'd string[]) and the post description is copied into the
 * `content` prop as markdown. Everything else stays "pending" until a
 * processor for that site exists. */

export type InstagramMediaKind = "reel" | "post";

const IG_PATH_RE = /^\/(reel|p)\/[A-Za-z0-9_-]+/;

/** Returns "reel" | "post" for Instagram reel/post URLs, null otherwise. */
export function instagramMediaKind(url: string): InstagramMediaKind | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "instagram.com" && host !== "instagr.am") return null;
    const m = u.pathname.match(IG_PATH_RE);
    if (!m) return null;
    return m[1] === "reel" ? "reel" : "post";
  } catch {
    return null;
  }
}

/** JSON/HTML-escaped URLs come back as https:\/\/…\u0026… — normalise them. */
function unescapeUrl(s: string): string {
  return s
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Reads a <meta property="…" content="…"> tag (either attribute order). */
function metaContent(html: string, property: string): string | null {
  const a = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i").exec(html);
  const b = a ?? new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i").exec(html);
  return b ? decodeEntities(b[1]) : null;
}

export interface InstagramFetchResult {
  /** Direct CDN media URLs (video for reels, one or more images for posts). */
  medias: string[];
  /** Post caption/description (og:description). */
  description: string | null;
}

/** Best-effort unauthenticated scrape: og meta tags + embedded JSON media
 *  (display_url / video_url entries cover multi-image posts). */
export async function fetchInstagramMedia(url: string): Promise<InstagramFetchResult> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`instagram fetch failed: HTTP ${res.status}`);
  const html = await res.text();

  const description = metaContent(html, "og:description");
  const medias: string[] = [];
  const push = (u: string | null) => {
    if (!u) return;
    const clean = unescapeUrl(u);
    if (clean.startsWith("http") && !medias.includes(clean)) medias.push(clean);
  };

  push(metaContent(html, "og:video") ?? metaContent(html, "og:video:url") ?? metaContent(html, "og:video:secure_url"));
  push(metaContent(html, "og:image"));
  // Multi-image posts: carousel entries live in the embedded JSON blob.
  for (const m of html.matchAll(/"display_url"\s*:\s*"((?:https?:)?[^"]+)"/g)) push(m[1]);
  for (const m of html.matchAll(/"video_url"\s*:\s*"((?:https?:)?[^"]+)"/g)) push(m[1]);

  return { medias, description };
}

/** Description (and any extra share text) as markdown, original link kept. */
function buildMarkdown(existing: string | null, description: string | null, url: string): string {
  const parts: string[] = [];
  const desc = description?.trim();
  const prev = existing?.trim();
  if (desc) parts.push(desc);
  if (prev && (!desc || !prev.includes(desc))) parts.push(prev);
  if (!parts.length) parts.push(`[${url}](${url})`);
  return parts.join("\n\n");
}

async function setRowStatus(databaseId: string, noteId: string, status: SharedContentStatus) {
  await updateRowProps(db, databaseId, noteId, { [SHARED_CONTENT_PROPS.status]: status });
}

const col = (name: string) => sql.raw(`"${name.replace(/"/g, "")}"`);

/** Process a single pending row. Returns false when the URL has no
 *  handler — the row is left "pending". */
export async function processSharedContentRow(
  databaseId: string,
  row: { noteId: string; url: string | null; content: string | null },
): Promise<boolean> {
  if (!row.url) return false;
  const kind = instagramMediaKind(row.url);
  if (!kind) return false; // no handler for this site yet — stays pending

  await setRowStatus(databaseId, row.noteId, "downloading");
  try {
    const result = await fetchInstagramMedia(row.url);
    if (!result.medias.length) throw new Error("no media found on page");

    await setRowStatus(databaseId, row.noteId, "processing");
    const content = buildMarkdown(row.content, result.description, row.url);
    await updateRowProps(db, databaseId, row.noteId, {
      [SHARED_CONTENT_PROPS.medias]: JSON.stringify(result.medias),
      [SHARED_CONTENT_PROPS.content]: content,
      [SHARED_CONTENT_PROPS.status]: "saved",
    });
    await db
      .updateTable("note_node")
      .set({ preview: content.slice(0, 200), updatedAt: new Date() })
      .where("id", "=", row.noteId)
      .execute();
    return true;
  } catch (err) {
    logger.warn({ err, databaseId, noteId: row.noteId, url: row.url }, "shared-content: processing failed");
    await setRowStatus(databaseId, row.noteId, "failed").catch(() => {});
    return true;
  }
}

const MAX_ROWS_PER_TICK = 10;
let tickRunning = false;

/** Scan every locked shared_content database for pending rows and process
 *  the ones we have handlers for. Safe to call repeatedly — overlapping
 *  ticks no-op. */
export async function processPendingSharedContent(): Promise<void> {
  if (tickRunning) return;
  tickRunning = true;
  try {
    const databases = await db
      .selectFrom("note_node")
      .select(["id"])
      .where("kind", "=", "database")
      .where("schemaLockedBy", "=", SHARED_CONTENT_LOCK)
      .where("deletedAt", "is", null)
      .execute();

    let budget = MAX_ROWS_PER_TICK;
    for (const database of databases) {
      if (budget <= 0) break;
      const result = await sql<{ noteId: string; url: string | null; content: string | null }>`
        SELECT "noteId", ${col(SHARED_CONTENT_PROPS.url)} AS url, ${col(SHARED_CONTENT_PROPS.content)} AS content
        FROM ${notesTable(database.id)}
        WHERE ${col(SHARED_CONTENT_PROPS.status)} = 'pending'
        ORDER BY "createdAt" ASC
        LIMIT ${budget}
      `.execute(db);
      for (const row of result.rows) {
        budget--;
        await processSharedContentRow(database.id, row);
      }
    }
  } finally {
    tickRunning = false;
  }
}

const TICK_MS = 30_000;
let timer: ReturnType<typeof setInterval> | null = null;

export function startSharedContentScheduler() {
  if (timer || ["1", "true", "yes"].includes((process.env.TWODB_SHARED_CONTENT_DISABLED ?? "").toLowerCase())) return;
  timer = setInterval(() => {
    processPendingSharedContent().catch((e) => logger.error({ err: e }, "shared-content: scheduler tick failed"));
  }, TICK_MS);
  if (typeof timer === "object" && "unref" in timer) timer.unref();
  logger.info("shared-content scheduler started");
}

export function stopSharedContentScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
