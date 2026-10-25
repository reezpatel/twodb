import { sql } from "kysely";
import { db } from "../auth";
import { logger } from "./logger";
import { SHARED_CONTENT_LOCK, SHARED_CONTENT_PROPS, type SharedContentStatus } from "./shared-content";
import { notesTable, updateRowProps } from "./notes-tables";
import { getPrivateSetting } from "./server-settings";
import { storeNoteAsset } from "./assets";

/** Background processing for shared_content rows with status "pending".
 *
 * Only Instagram reel (/reel/<id>) and post (/p/<id>) URLs are handled:
 * the page is fetched, media is downloaded into storage and the `medias`
 * prop (a `media` column) gets the resulting media ids; the post description
 * is copied into the `content` prop as markdown. Everything else stays
 * "pending" until a processor for that site exists. */

export type InstagramMediaKind = "reel" | "post";

const IG_PATH_RE = /^\/(reel|p)\/([A-Za-z0-9_-]+)/;

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

/** Shortcode ("Dee3pIrPENG") from a reel/post URL — used for media filenames. */
function shortcodeOfUrl(url: string): string | null {
  try {
    return new URL(url).pathname.match(IG_PATH_RE)?.[2] ?? null;
  } catch {
    return null;
  }
}

/** JSON/HTML-escaped URLs come back as https:\/\/…\u0026… — normalise them.
 *  Embed pages nest JSON inside JSON, so decode iteratively (\\\\/ → \\/ → /). */
function unescapeUrl(s: string): string {
  let prev = s;
  for (let i = 0; i < 3; i++) {
    const next = prev
      .replace(/\\\//g, "/")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&amp;/g, "&");
    if (next === prev) break;
    prev = next;
  }
  try {
    return decodeURIComponent(prev);
  } catch {
    return prev;
  }
}

/** Decodes a JSON string fragment that may be escaped multiple times
 *  (embed pages embed JSON inside JSON). */
function decodeJsonString(raw: string): string {
  let s = raw;
  for (let i = 0; i < 3; i++) {
    try {
      const parsed = JSON.parse(`"${s}"`);
      if (parsed === s) break;
      s = parsed;
    } catch {
      break;
    }
  }
  return s;
}

/** Matches a JSON string value with 1-2 levels of backslash escaping:
 *  "key":"value" or \\"key\\":\\"value\\". */
function escapedJsonValues(html: string, key: string): string[] {
  const re = new RegExp(`\\\\{1,2}"${key}\\\\{1,2}":\\\\{1,2}"((?:[^"\\\\]|\\\\.)*?)\\\\{1,2}"`, "g");
  const out: string[] = [];
  for (const m of html.matchAll(re)) out.push(decodeJsonString(m[1]));
  return out;
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
  /** Post caption/description. */
  description: string | null;
}

/** A media item stored locally. Only the media id lands in the row's
 *  `medias` prop (a `media` column) — the rest is download bookkeeping. */
export interface StoredMediaDescriptor {
  /** Remote CDN URL it was fetched from (expires). */
  sourceUrl: string;
  /** Local reference: /api/storage/resolve/<mediaId> — streams on path
   *  backends, redirects to a presigned URL on object backends. */
  uri: string;
  mediaId: string;
  backendId: string;
  path: string;
  filename: string;
  contentType: string | null;
  size: number;
}

interface StrategyResult {
  medias: string[];
  description: string | null;
  author: string | null;
}

/** Instagram's link-preview crawlers still get served real pages — a normal
 *  browser UA gets a login wall. */
const IG_CRAWLER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const IG_MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

/** Instagram session cookie (`sessionid`), configured per org in
 *  Settings → Shared Content (stored in the org's shared_content_targets
 *  settings blob). Unlocks posts behind login/age gates that anonymous
 *  strategies can't see. */
const sessionCache = new Map<string, { value: string | null; at: number }>();

async function instagramSessionId(organizationId: string): Promise<string | null> {
  const cached = sessionCache.get(organizationId);
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  const settings = await getPrivateSetting<{ instagramSessionId?: string }>(`shared_content_targets:${organizationId}`).catch(() => null);
  const raw = (settings?.instagramSessionId ?? "").trim();
  let value: string | null = raw || null;
  if (value) {
    try {
      value = decodeURIComponent(value);
    } catch {
      // keep as-is
    }
  }
  sessionCache.set(organizationId, { value, at: Date.now() });
  return value;
}

async function fetchHtml(url: string, opts: { userAgent?: string; cookie?: string } = {}): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent": opts.userAgent ?? IG_CRAWLER_UA,
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function empty(): StrategyResult {
  return { medias: [], description: null, author: null };
}

/** og:title looks like `owner on Instagram: "caption"` — strip the wrapper. */
function captionFromOgTitle(title: string | null): string | null {
  if (!title) return null;
  const m = /on Instagram: ["“](.*)["”]$/s.exec(title);
  return (m ? m[1] : title).trim() || null;
}

/** Strategy 1 (strongest): the /embed/ page carries a nested JSON blob with
 *  the raw caption (edge_media_to_caption), video_url for reels and
 *  display_url entries for image posts. */
async function fromEmbed(url: string): Promise<StrategyResult> {
  const embedUrl = url.replace(/(\/(?:reel|p)\/[A-Za-z0-9_-]+)\/?(\?.*)?$/, "$1/embed/");
  const html = await fetchHtml(embedUrl);
  const out = empty();
  for (const u of escapedJsonValues(html, "video_url")) out.medias.push(unescapeUrl(u));
  for (const u of escapedJsonValues(html, "display_url")) out.medias.push(unescapeUrl(u));
  const i = html.indexOf("edge_media_to_caption");
  if (i >= 0) out.description = escapedJsonValues(html.slice(i, i + 8000), "text")[0] ?? null;
  return out;
}

/** Strategy 2: the canonical page served to link-preview crawlers has
 *  og:video / og:image + the caption wrapped in og:title. */
async function fromCanonical(url: string): Promise<StrategyResult> {
  const html = await fetchHtml(url);
  const out = empty();
  const video = metaContent(html, "og:video") ?? metaContent(html, "og:video:url") ?? metaContent(html, "og:video:secure_url");
  if (video) out.medias.push(video);
  const image = metaContent(html, "og:image");
  if (image) out.medias.push(image);
  out.description = captionFromOgTitle(metaContent(html, "og:title")) ?? metaContent(html, "og:description");
  return out;
}

/** Strategy 3 (last resort, no auth needed): the oEmbed API. Never yields
 *  media, but has the caption + author even for posts that login-wall the
 *  page. Age/private gated content returns an error JSON here. */
async function fromOEmbed(url: string): Promise<StrategyResult> {
  const res = await fetch(`https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`, {
    headers: { "user-agent": IG_CRAWLER_UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string; message?: string };
  const out = empty();
  out.description = json.title ?? null;
  out.author = json.author_name ?? null;
  if (json.thumbnail_url) out.medias.push(json.thumbnail_url);
  return out;
}

/** Strategy 4 (needs the org's session cookie from settings): authenticated
 *  fetch with a mobile UA — the only way to see login/age-gated posts.
 *  Yields og:image + caption; no video/carousel URLs. Returns empty when no
 *  session is configured. */
async function fromAuthenticated(url: string, organizationId: string): Promise<StrategyResult> {
  const sessionId = await instagramSessionId(organizationId);
  if (!sessionId) return empty();
  const html = await fetchHtml(url, { userAgent: IG_MOBILE_UA, cookie: `sessionid=${sessionId}` });
  const out = empty();
  const image = metaContent(html, "og:image");
  if (image) out.medias.push(image);
  out.description = metaContent(html, "og:description") ?? captionFromOgTitle(metaContent(html, "og:title"));
  return out;
}

/** Runs the strategies strongest-first and merges what each found — a
 *  failed strategy just means the next one fills the gaps. */
export async function fetchInstagramMedia(url: string, organizationId: string): Promise<InstagramFetchResult> {
  const merged = empty();
  for (const [name, strategy] of [
    ["embed", fromEmbed],
    ["canonical", fromCanonical],
    ["oembed", fromOEmbed],
    ["authenticated", fromAuthenticated],
  ] as const) {
    try {
      const r = await strategy(url, organizationId);
      for (const u of r.medias) if (u.startsWith("http") && !merged.medias.includes(u)) merged.medias.push(u);
      merged.description ??= r.description;
      merged.author ??= r.author;
    } catch (err) {
      logger.debug({ err, strategy: name, url }, "shared-content: instagram strategy failed");
    }
  }
  return { medias: merged.medias, description: merged.description };
}

/** Downloads the scraped media URLs into the note_assets storage
 *  destination — IG CDN URLs are signature-bound and expire, so the row
 *  references the local copies (https resolve urls) instead. Storage
 *  unconfigured / expired URL → that item is skipped (sourceUrl kept in
 *  the markdown content as the permalink anyway). */
const MEDIA_DOWNLOAD_MAX_BYTES = 100 * 1024 * 1024;

async function downloadMedias(organizationId: string, urls: string[], shortcode: string, kind: InstagramMediaKind): Promise<StoredMediaDescriptor[]> {
  // Reels: the video is the content — skip thumbnails.
  if (kind === "reel") urls = urls.filter((u) => u.includes(".mp4"));
  if (!urls.length) return [];
  const stored: StoredMediaDescriptor[] = [];
  for (let i = 0; i < urls.length; i++) {
    const sourceUrl = urls[i];
    try {
      const res = await fetch(sourceUrl, {
        headers: { "user-agent": IG_CRAWLER_UA },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? null;
      const data = Buffer.from(await res.arrayBuffer());
      if (data.length > MEDIA_DOWNLOAD_MAX_BYTES) throw new Error(`too large (${data.length} bytes)`);
      const extension = contentType === "video/mp4" ? "mp4" : contentType === "image/webp" ? "webp" : contentType === "image/png" ? "png" : "jpg";
      const asset = await storeNoteAsset({
        organizationId,
        filename: `ig-${shortcode}-${i + 1}.${extension}`,
        contentType,
        data,
      });
      stored.push({ sourceUrl, uri: asset.uri, mediaId: asset.id, backendId: asset.backendId, path: asset.path, filename: asset.filename, contentType: asset.contentType, size: asset.size });
    } catch (err) {
      logger.warn({ err, sourceUrl: sourceUrl.slice(0, 120) }, "shared-content: media download failed");
    }
  }
  return stored;
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
  organizationId: string,
  databaseId: string,
  row: { noteId: string; url: string | null; content: string | null },
): Promise<boolean> {
  if (!row.url) return false;
  const kind = instagramMediaKind(row.url);
  if (!kind) return false; // no handler for this site yet — stays pending

  await setRowStatus(databaseId, row.noteId, "downloading");
  try {
    const result = await fetchInstagramMedia(row.url, organizationId);
    // Nothing at all — not even a caption — means every strategy failed.
    if (!result.medias.length && !result.description) throw new Error("no media found on page");

    await setRowStatus(databaseId, row.noteId, "processing");
    const content = buildMarkdown(row.content, result.description, row.url);
    // Download the scraped media into local storage — IG CDN URLs are
    // signature-bound and expire; the row references the local copies.
    const medias = await downloadMedias(organizationId, result.medias, shortcodeOfUrl(row.url) ?? "media", kind);
    await updateRowProps(db, databaseId, row.noteId, {
      [SHARED_CONTENT_PROPS.medias]: medias.map((m) => m.mediaId),
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
      .select(["id", "organizationId"])
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
        await processSharedContentRow(database.organizationId, database.id, row);
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
