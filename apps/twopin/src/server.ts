import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import { BODY_LIMIT, webappRewriteUrl, registerWebapp, webappDist } from "@twodb/twodb-core/webapp";
import type { Selectable } from "kysely";
import { createPgDb } from "@twodb/core-data/db";

import { manifest } from "./manifest.js";
import type { TwoPinConfig } from "./config.js";
import { applySchema, type TwoPinDb, type PinRow, type BoardRow, type BookmarkFolderRow, type BookmarkRow } from "./db/schema.js";
import { createBoardsRepo, createPinsRepo, createBookmarkFoldersRepo, createBookmarksRepo, createSettingsRepo } from "./db/repository.js";
import { readForwardedContext, type ForwardedContext } from "./gateway-context.js";
import { fetchLinkMetadata, FetchError } from "./lib/link-metadata.js";

/** Strips binary columns and exposes booleans the UI builds <img> tags from. */
function pinDto(pin: Selectable<PinRow>) {
  return {
    id: pin.id,
    boardId: pin.board_id,
    url: pin.url,
    finalUrl: pin.final_url,
    title: pin.title,
    description: pin.description,
    note: pin.note,
    siteName: pin.site_name,
    status: pin.status,
    fetchError: pin.fetch_error,
    fetchedAt: pin.fetched_at ? new Date(pin.fetched_at).toISOString() : null,
    hasImage: pin.image != null,
    hasFavicon: pin.favicon != null,
    hasMedia: pin.media != null,
    mediaContentType: pin.media_content_type,
    heroKind: pin.hero_kind,
    heroContentType: pin.hero_content_type,
    tags: Array.isArray(pin.tags) ? pin.tags : [],
    createdBy: pin.created_by,
    createdAt: new Date(pin.created_at).toISOString(),
  };
}

function boardDto(board: Selectable<BoardRow> & { pin_count?: number }) {
  return {
    id: board.id,
    spaceId: board.space_id,
    name: board.name,
    description: board.description,
    pinCount: board.pin_count ?? 0,
    createdBy: board.created_by,
    createdAt: new Date(board.created_at).toISOString(),
  };
}

function toDataUri(bytes: Buffer | null, contentType: string | null): string | null {
  if (!bytes || !contentType) return null;
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

function bookmarkFolderDto(folder: Selectable<BookmarkFolderRow> & { bookmark_count?: number }) {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parent_id,
    bookmarkCount: folder.bookmark_count ?? 0,
    createdBy: folder.created_by,
    createdAt: new Date(folder.created_at).toISOString(),
  };
}

function bookmarkDto(bookmark: Selectable<BookmarkRow>) {
  return {
    id: bookmark.id,
    folderId: bookmark.folder_id,
    url: bookmark.url,
    title: bookmark.title,
    description: bookmark.description,
    hasFavicon: bookmark.favicon != null,
    createdBy: bookmark.created_by,
    createdAt: new Date(bookmark.created_at).toISOString(),
  };
}

/** Adds a scheme when missing so bare domains work. */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export async function buildServer(config: TwoPinConfig) {
  const app = Fastify({ rewriteUrl: webappRewriteUrl, logger: true, bodyLimit: BODY_LIMIT });
  const db = createPgDb<TwoPinDb>({ connectionString: config.DATABASE_URL, schema: "twopin" });
  await applySchema(db);
  const boards = createBoardsRepo(db);
  const pins = createPinsRepo(db);
  const bookmarkFolders = createBookmarkFoldersRepo(db);
  const bookmarks = createBookmarksRepo(db);
  const settings = createSettingsRepo(db);

  const auth = (req: FastifyRequest, reply: FastifyReply): ForwardedContext | null => {
    const ctx = readForwardedContext(req);
    if (!ctx) void reply.code(401).send({ error: "unauthorized" });
    return ctx;
  };

  /** Runs a metadata fetch and stores the outcome on the pin. */
  async function fetchAndApply(pinId: string, url: string, overwriteText: boolean) {
    try {
      const meta = await fetchLinkMetadata(url);
      return await pins.applyFetch(pinId, {
        ok: true,
        finalUrl: meta.finalUrl,
        title: meta.title,
        description: meta.description,
        siteName: meta.siteName,
        image: meta.image,
        imageContentType: meta.imageContentType,
        favicon: meta.favicon,
        faviconContentType: meta.faviconContentType,
        overwriteText,
      });
    } catch (err) {
      const message = err instanceof FetchError ? err.message : `unexpected error: ${(err as Error).message}`;
      return await pins.applyFetch(pinId, { ok: false, error: message });
    }
  }

  app.get("/healthz", async () => ({ ok: true, app: manifest.slug }));

  // Pull-registration endpoint: TwoDB's orchestrator polls this on the
  // container's published port and completes registration itself.

  // --- Boards ---------------------------------------------------------------
  app.get("/boards", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    return (await boards.list(ctx.workspaceId)).map(boardDto);
  });

  app.post("/boards", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const body = req.body as { name?: string; description?: string; spaceId?: string };
    if (!body?.name?.trim()) return reply.code(400).send({ error: "name is required" });
    const board = await boards.create({
      workspaceId: ctx.workspaceId,
      spaceId: body.spaceId ?? null,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      createdBy: ctx.userId,
    });
    return reply.code(201).send(boardDto(board));
  });

  app.patch("/boards/:id", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { id } = req.params as { id: string };
    const body = req.body as { name?: string; description?: string | null; spaceId?: string | null };
    if (body?.name !== undefined && !body.name.trim()) return reply.code(400).send({ error: "name cannot be empty" });
    const board = await boards.update(ctx.workspaceId, id, {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
      ...(body.spaceId !== undefined ? { spaceId: body.spaceId } : {}),
    });
    if (!board) return reply.code(404).send({ error: "board not found" });
    return boardDto(board);
  });

  app.delete("/boards/:id", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { id } = req.params as { id: string };
    if (!(await boards.remove(ctx.workspaceId, id))) return reply.code(404).send({ error: "board not found" });
    return { ok: true };
  });

  // --- Pins -----------------------------------------------------------------
  app.get("/pins", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { boardId, tag } = req.query as { boardId?: string; tag?: string };
    return (await pins.list(ctx.workspaceId, boardId, tag)).map(pinDto);
  });

  /** Distinct pin tags for filter chips / autocomplete suggestions. */
  app.get("/tags", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    return pins.listTags(ctx.workspaceId);
  });

  app.get("/pins/:id", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { id } = req.params as { id: string };
    const pin = await pins.get(ctx.workspaceId, id);
    if (!pin) return reply.code(404).send({ error: "pin not found" });
    return pinDto(pin);
  });

  app.post("/pins", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const body = req.body as {
      boardId?: string;
      url?: string | null;
      note?: string;
      title?: string;
      /** base64-encoded media bytes for a direct image/video upload. */
      mediaBase64?: string;
      mediaContentType?: string;
      tags?: string[];
    };
    if (!body?.boardId) return reply.code(400).send({ error: "boardId is required" });
    const board = await boards.get(ctx.workspaceId, body.boardId);
    if (!board) return reply.code(404).send({ error: "board not found" });

    // URL is optional — a pin can be a bare media upload. Normalize when present.
    let url: string | null = null;
    if (body.url?.trim()) {
      url = body.url.trim();
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    }

    // Decode an optional direct media upload (image/* or video/*).
    let media: Buffer | null = null;
    let mediaContentType: string | null = null;
    if (body.mediaBase64) {
      mediaContentType = (body.mediaContentType ?? "application/octet-stream").split(";")[0].trim();
      if (!/^(image|video)\//.test(mediaContentType)) return reply.code(415).send({ error: "media must be image/* or video/*" });
      try {
        media = Buffer.from(body.mediaBase64, "base64");
      } catch {
        return reply.code(400).send({ error: "invalid base64 media" });
      }
      if (media.length === 0) return reply.code(400).send({ error: "empty media" });
    }

    if (!url && !media) return reply.code(400).send({ error: "provide a url or a media upload" });

    const pin = await pins.create({
      workspaceId: ctx.workspaceId,
      boardId: board.id,
      url,
      note: body.note?.trim() || null,
      media,
      mediaContentType,
      tags: body.tags,
      createdBy: ctx.userId,
    });

    // Only fetch link metadata when there's actually a URL to fetch.
    if (url) {
      const fetched = await fetchAndApply(pin.id, url, /* overwriteText */ false);
      return reply.code(201).send(pinDto(fetched ?? pin));
    }
    // Media pins are immediately ok; seed the title from the upload caption if given.
    await pins.update(ctx.workspaceId, pin.id, { title: body.title?.trim() || null });
    await db.updateTable("pin").set({ status: "ok", fetched_at: new Date() }).where("id", "=", pin.id).execute();
    const final = await pins.get(ctx.workspaceId, pin.id);
    return reply.code(201).send(pinDto(final ?? pin));
  });

  app.patch("/pins/:id", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { id } = req.params as { id: string };
    const body = req.body as {
      boardId?: string;
      title?: string | null;
      description?: string | null;
      note?: string | null;
      url?: string;
      tags?: string[];
    };
    const existing = await pins.get(ctx.workspaceId, id);
    if (!existing) return reply.code(404).send({ error: "pin not found" });
    if (body.boardId && body.boardId !== existing.board_id) {
      const board = await boards.get(ctx.workspaceId, body.boardId);
      if (!board) return reply.code(404).send({ error: "target board not found" });
    }

    let urlChanged = false;
    let url: string | undefined;
    if (body.url !== undefined) {
      url = body.url.trim();
      if (!url) return reply.code(400).send({ error: "url cannot be empty" });
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      urlChanged = url !== existing.url;
    }

    const updated = await pins.update(ctx.workspaceId, id, {
      ...(body.boardId !== undefined ? { boardId: body.boardId } : {}),
      ...(body.title !== undefined ? { title: body.title?.trim() || null } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
      ...(body.note !== undefined ? { note: body.note?.trim() || null } : {}),
      ...(body.tags !== undefined ? { tags: body.tags } : {}),
      ...(urlChanged ? { url } : {}),
    });
    if (!updated) return reply.code(404).send({ error: "pin not found" });
    if (urlChanged && url) {
      const fetched = await fetchAndApply(id, url, /* overwriteText */ true);
      return pinDto(fetched ?? updated);
    }
    return pinDto(updated);
  });

  app.post("/pins/:id/refresh", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { id } = req.params as { id: string };
    const pin = await pins.get(ctx.workspaceId, id);
    if (!pin) return reply.code(404).send({ error: "pin not found" });
    if (!pin.url) return reply.code(400).send({ error: "pin has no url to refresh" });
    const fetched = await fetchAndApply(id, pin.url, /* overwriteText */ true);
    return pinDto(fetched ?? pin);
  });

  app.delete("/pins/:id", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { id } = req.params as { id: string };
    if (!(await pins.remove(ctx.workspaceId, id))) return reply.code(404).send({ error: "pin not found" });
    return { ok: true };
  });

  // --- Stored assets (downloaded at fetch time; UI never hotlinks) -----------
  app.get("/pins/:id/image", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { id } = req.params as { id: string };
    const pin = await pins.get(ctx.workspaceId, id);
    if (!pin?.image || !pin.image_content_type) return reply.code(404).send({ error: "no image" });
    return reply
      .header("content-type", pin.image_content_type)
      .header("cache-control", "private, max-age=86400")
      .send(pin.image);
  });

  /** Serves a pin's directly-uploaded media (image or video). */
  app.get("/pins/:id/media", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { id } = req.params as { id: string };
    const pin = await pins.get(ctx.workspaceId, id);
    if (!pin?.media || !pin.media_content_type) return reply.code(404).send({ error: "no media" });
    return reply
      .header("content-type", pin.media_content_type)
      .header("cache-control", "private, max-age=86400")
      .send(pin.media);
  });

  /** Upload/replace a pin's media (image/* or video/*), base64 JSON body. */
  app.post("/pins/:id/media", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { id } = req.params as { id: string };
    const body = req.body as { mediaBase64?: string; mediaContentType?: string };
    if (!body?.mediaBase64) return reply.code(400).send({ error: "mediaBase64 is required" });
    const pin = await pins.get(ctx.workspaceId, id);
    if (!pin) return reply.code(404).send({ error: "pin not found" });
    const contentType = (body.mediaContentType ?? "application/octet-stream").split(";")[0].trim();
    if (!/^(image|video)\//.test(contentType)) return reply.code(415).send({ error: "media must be image/* or video/*" });
    let bytes: Buffer;
    try {
      bytes = Buffer.from(body.mediaBase64, "base64");
    } catch {
      return reply.code(400).send({ error: "invalid base64 media" });
    }
    if (bytes.length === 0) return reply.code(400).send({ error: "empty media" });
    const updated = await pins.setMedia(ctx.workspaceId, id, bytes, contentType);
    return pinDto(updated ?? pin);
  });

  app.get("/pins/:id/favicon", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { id } = req.params as { id: string };
    const pin = await pins.get(ctx.workspaceId, id);
    if (!pin?.favicon || !pin.favicon_content_type) return reply.code(404).send({ error: "no favicon" });
    return reply
      .header("content-type", pin.favicon_content_type)
      .header("cache-control", "private, max-age=86400")
      .send(pin.favicon);
  });

  // --- Settings (share target board, etc) ------------------------------------
  app.get("/settings", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    return settings.get(ctx.workspaceId);
  });

  app.patch("/settings", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const body = req.body as { defaultBoardId?: string | null };
    if (body.defaultBoardId) {
      const board = await boards.get(ctx.workspaceId, body.defaultBoardId);
      if (!board) return reply.code(404).send({ error: "board not found" });
    }
    if (body.defaultBoardId !== undefined) await settings.setDefaultBoard(ctx.workspaceId, body.defaultBoardId);
    return settings.get(ctx.workspaceId);
  });

  // --- Share target: save a shared URL straight into the configured board -----
  app.post("/share-save", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const body = req.body as { url?: string; note?: string };
    if (!body?.url?.trim()) return reply.code(400).send({ error: "url is required" });
    const url = normalizeUrl(body.url);
    // Resolve the target board: the workspace's configured default, else first, else create one.
    let boardId = (await settings.get(ctx.workspaceId)).defaultBoardId;
    if (!boardId || !(await boards.get(ctx.workspaceId, boardId))) {
      const list = await boards.list(ctx.workspaceId);
      boardId = list[0]?.id ?? (await boards.create({ workspaceId: ctx.workspaceId, name: "Shared", description: "Links shared to TwoPin.", createdBy: ctx.userId })).id;
    }
    const pin = await pins.create({ workspaceId: ctx.workspaceId, boardId, url, note: body.note?.trim() || null, createdBy: ctx.userId });
    const fetched = await fetchAndApply(pin.id, url, /* overwriteText */ false);
    return reply.code(201).send(pinDto(fetched ?? pin));
  });

  // --- Preview (fetch metadata without saving — powers the add-pin dialog) ---
  app.post("/metadata/preview", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const body = req.body as { url?: string };
    if (!body?.url?.trim()) return reply.code(400).send({ error: "url is required" });
    let url = body.url.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      const meta = await fetchLinkMetadata(url);
      return {
        ok: true as const,
        finalUrl: meta.finalUrl,
        title: meta.title,
        description: meta.description,
        siteName: meta.siteName,
        imageDataUri: toDataUri(meta.image, meta.imageContentType),
        faviconDataUri: toDataUri(meta.favicon, meta.faviconContentType),
      };
    } catch (err) {
      const message = err instanceof FetchError ? err.message : `unexpected error: ${(err as Error).message}`;
      return reply.code(422).send({ ok: false as const, error: message });
    }
  });

  // --- Bookmark folders ------------------------------------------------------
  app.get("/bookmark-folders", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    return (await bookmarkFolders.list(ctx.workspaceId)).map(bookmarkFolderDto);
  });

  app.post("/bookmark-folders", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const body = req.body as { name?: string; parentId?: string | null };
    if (!body?.name?.trim()) return reply.code(400).send({ error: "name is required" });
    if (body.parentId && !(await bookmarkFolders.get(ctx.workspaceId, body.parentId))) return reply.code(404).send({ error: "parent folder not found" });
    const folder = await bookmarkFolders.create({ workspaceId: ctx.workspaceId, name: body.name.trim(), parentId: body.parentId ?? null, createdBy: ctx.userId });
    return reply.code(201).send(bookmarkFolderDto(folder));
  });

  app.patch("/bookmark-folders/:id", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { id } = req.params as { id: string };
    const body = req.body as { name?: string; parentId?: string | null };
    if (body?.name !== undefined && !body.name.trim()) return reply.code(400).send({ error: "name cannot be empty" });
    if (body.parentId) {
      if (body.parentId === id) return reply.code(400).send({ error: "a folder cannot be its own parent" });
      if (!(await bookmarkFolders.get(ctx.workspaceId, body.parentId))) return reply.code(404).send({ error: "parent folder not found" });
    }
    const folder = await bookmarkFolders.update(ctx.workspaceId, id, {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
    });
    if (!folder) return reply.code(404).send({ error: "folder not found" });
    return bookmarkFolderDto(folder);
  });

  app.delete("/bookmark-folders/:id", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { id } = req.params as { id: string };
    if (!(await bookmarkFolders.remove(ctx.workspaceId, id))) return reply.code(404).send({ error: "folder not found" });
    return { ok: true };
  });

  // --- Bookmarks -------------------------------------------------------------
  app.get("/bookmarks", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { folderId } = req.query as { folderId?: string };
    return (await bookmarks.list(ctx.workspaceId, folderId)).map(bookmarkDto);
  });

  app.post("/bookmarks", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const body = req.body as { folderId?: string | null; url?: string; title?: string; description?: string };
    if (!body?.url?.trim()) return reply.code(400).send({ error: "url is required" });
    const url = normalizeUrl(body.url);
    if (body.folderId) {
      const folder = await bookmarkFolders.get(ctx.workspaceId, body.folderId);
      if (!folder) return reply.code(404).send({ error: "folder not found" });
    }
    // Fetch metadata server-side so the list shows real titles + favicons.
    let meta: Awaited<ReturnType<typeof fetchLinkMetadata>> | null = null;
    try {
      meta = await fetchLinkMetadata(url);
    } catch {
      meta = null; // keep the bookmark even if the fetch failed
    }
    const bookmark = await bookmarks.create({
      workspaceId: ctx.workspaceId,
      folderId: body.folderId ?? null,
      url: meta?.finalUrl ?? url,
      title: body.title?.trim() || meta?.title || null,
      description: body.description?.trim() || meta?.description || null,
      favicon: meta?.favicon ?? null,
      faviconContentType: meta?.faviconContentType ?? null,
      createdBy: ctx.userId,
    });
    return reply.code(201).send(bookmarkDto(bookmark));
  });

  app.patch("/bookmarks/:id", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { id } = req.params as { id: string };
    const body = req.body as { folderId?: string | null; url?: string; title?: string | null; description?: string | null };
    const existing = await bookmarks.get(ctx.workspaceId, id);
    if (!existing) return reply.code(404).send({ error: "bookmark not found" });
    if (body.folderId) {
      const folder = await bookmarkFolders.get(ctx.workspaceId, body.folderId);
      if (!folder) return reply.code(404).send({ error: "folder not found" });
    }
    let faviconPatch: { favicon?: Buffer | null; faviconContentType?: string | null } = {};
    let urlPatch: { url?: string } = {};
    if (body.url !== undefined) {
      const url = normalizeUrl(body.url);
      if (!url) return reply.code(400).send({ error: "url cannot be empty" });
      if (url !== existing.url) {
        urlPatch = { url };
        // Refresh the favicon for the new URL (best-effort).
        try {
          const meta = await fetchLinkMetadata(url);
          faviconPatch = { favicon: meta.favicon, faviconContentType: meta.faviconContentType };
          urlPatch = { url: meta.finalUrl };
        } catch {
          faviconPatch = { favicon: null, faviconContentType: null };
        }
      }
    }
    const updated = await bookmarks.update(ctx.workspaceId, id, {
      ...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
      ...urlPatch,
      ...(body.title !== undefined ? { title: body.title?.trim() || null } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
      ...faviconPatch,
    });
    if (!updated) return reply.code(404).send({ error: "bookmark not found" });
    return bookmarkDto(updated);
  });

  app.delete("/bookmarks/:id", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { id } = req.params as { id: string };
    if (!(await bookmarks.remove(ctx.workspaceId, id))) return reply.code(404).send({ error: "bookmark not found" });
    return { ok: true };
  });

  app.get("/bookmarks/:id/favicon", async (req, reply) => {
    const ctx = auth(req, reply);
    if (!ctx) return;
    const { id } = req.params as { id: string };
    const bookmark = await bookmarks.get(ctx.workspaceId, id);
    if (!bookmark?.favicon || !bookmark.favicon_content_type) return reply.code(404).send({ error: "no favicon" });
    return reply
      .header("content-type", bookmark.favicon_content_type)
      .header("cache-control", "private, max-age=86400")
      .send(bookmark.favicon);
  });

  await registerWebapp(app, { distDir: webappDist(import.meta.dirname) });
  return app;
}
