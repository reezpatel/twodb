import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import type { Selectable } from "kysely";
import { createPgDb } from "@twodb/core-data/db";
import {
  INTERNAL_MANIFEST_PATH,
  REGISTRATION_TOKEN_HEADER,
  handleManifestRequest,
} from "@twodb/core-platform/manifest";
import { manifest } from "./manifest.js";
import type { TwoPinConfig } from "./config.js";
import { applySchema, type TwoPinDb, type PinRow, type BoardRow } from "./db/schema.js";
import { createBoardsRepo, createPinsRepo } from "./db/repository.js";
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

export async function buildServer(config: TwoPinConfig) {
  const app = Fastify({ logger: true });
  const db = createPgDb<TwoPinDb>({ connectionString: config.DATABASE_URL, schema: "twopin" });
  await applySchema(db);
  const boards = createBoardsRepo(db);
  const pins = createPinsRepo(db);

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
  app.get(INTERNAL_MANIFEST_PATH, async (req, reply) => {
    const res = handleManifestRequest(
      manifest,
      { registrationToken: config.TWODB_PROVISION_TOKEN, httpUrl: config.HTTP_URL },
      req.headers[REGISTRATION_TOKEN_HEADER],
    );
    return reply.code(res.status).send(res.body);
  });

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
    const { boardId } = req.query as { boardId?: string };
    return (await pins.list(ctx.workspaceId, boardId)).map(pinDto);
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
    const body = req.body as { boardId?: string; url?: string; note?: string };
    if (!body?.boardId) return reply.code(400).send({ error: "boardId is required" });
    if (!body?.url?.trim()) return reply.code(400).send({ error: "url is required" });
    let url = body.url.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const board = await boards.get(ctx.workspaceId, body.boardId);
    if (!board) return reply.code(404).send({ error: "board not found" });

    const pin = await pins.create({
      workspaceId: ctx.workspaceId,
      boardId: board.id,
      url,
      note: body.note?.trim() || null,
      createdBy: ctx.userId,
    });
    const fetched = await fetchAndApply(pin.id, url, /* overwriteText */ false);
    return reply.code(201).send(pinDto(fetched ?? pin));
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

  return app;
}
