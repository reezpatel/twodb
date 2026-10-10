import { Hono } from "hono";
import { requireOrgSession } from "../lib/session";
import { logger } from "../lib/logger";
import {
  abandonRecording,
  appendChunk,
  finalizeRecording,
  getRecording,
  heartbeatRecording,
  listRecordings,
  startRecording,
  TRACK_IDS,
} from "../lib/meetings";

// Meeting-recorder ingestion API. Auth is the org session cookie or an org
// API key (x-api-key) — the extension uses the latter.

export const meetingsRoutes = new Hono()
  .use("*", async (c, next) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    await next();
  })

  .post("/recordings", async (c) => {
    const s = (await requireOrgSession(c))!;
    const body = await c.req.json().catch(() => null);
    const platform = typeof body?.platform === "string" && body.platform.trim() ? body.platform.trim() : "";
    if (!platform) return c.json({ error: "invalid_platform" }, 400);

    const rawTracks: { trackId?: string }[] = Array.isArray(body?.tracks) ? body.tracks : [];
    const tracks = rawTracks.filter((t): t is { trackId: string } => typeof t?.trackId === "string" && TRACK_IDS.has(t.trackId));
    if (tracks.length === 0) return c.json({ error: "invalid_tracks" }, 400);

    try {
      const started = await startRecording(s.organizationId, {
        platform,
        title: typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 300) : null,
        meetingUrl: typeof body.meetingUrl === "string" ? body.meetingUrl.slice(0, 2000) : null,
        clientSessionId: typeof body.clientSessionId === "string" ? body.clientSessionId.slice(0, 100) : null,
        tracks,
      });
      return c.json(
        {
          recordingId: started.recording.id,
          resumed: started.resumed,
          status: started.recording.status,
          tracks: started.tracks.map((t) => ({ trackId: t.trackId, nextSeq: t.nextSeq })),
        },
        started.resumed ? 200 : 201,
      );
    } catch (e) {
      logger.error({ err: e, organizationId: s.organizationId }, "meeting recording start failed");
      return c.json({ error: "start_failed" }, 500);
    }
  })

  .post("/recordings/:id/tracks/:track/chunks", async (c) => {
    const s = (await requireOrgSession(c))!;
    const recordingId = c.req.param("id");
    const trackId = c.req.param("track");
    const seq = Number(c.req.query("seq"));
    const checksum = c.req.header("x-chunk-sha256") ?? undefined;

    if (!TRACK_IDS.has(trackId)) return c.json({ error: "invalid_track" }, 400);

    const bytes = Buffer.from(await c.req.arrayBuffer());
    const result = await appendChunk(s.organizationId, recordingId, trackId, seq, bytes, checksum);

    if ("notFound" in result) return c.json({ error: "not_found" }, 404);
    if ("notRecording" in result) return c.json({ error: "not_recording" }, 409);
    if ("tooLarge" in result) return c.json({ error: "chunk_too_large" }, 413);
    if ("conflict" in result) return c.json({ error: "seq_conflict", expectedSeq: result.conflict.expectedSeq }, 409);
    return c.json(result, 200);
  })

  .post("/recordings/:id/heartbeat", async (c) => {
    const s = (await requireOrgSession(c))!;
    const ok = await heartbeatRecording(s.organizationId, c.req.param("id"));
    if (!ok) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  })

  .post("/recordings/:id/finalize", async (c) => {
    const s = (await requireOrgSession(c))!;
    const body = await c.req.json().catch(() => null);
    const rawTracks: { trackId?: string; totalChunks?: unknown; durationMs?: unknown; startedAt?: unknown }[] = Array.isArray(body?.tracks)
      ? body.tracks
      : [];
    const tracks = rawTracks
      .filter((t): t is { trackId: string; totalChunks?: unknown; durationMs?: unknown; startedAt?: unknown } => typeof t?.trackId === "string" && TRACK_IDS.has(t.trackId))
      .map((t) => ({
        trackId: t.trackId,
        totalChunks: typeof t.totalChunks === "number" ? t.totalChunks : undefined,
        durationMs: typeof t.durationMs === "number" ? t.durationMs : undefined,
        startedAt: typeof t.startedAt === "string" ? t.startedAt : undefined,
      }));

    try {
      const result = await finalizeRecording(s.organizationId, c.req.param("id"), tracks);
      if ("notFound" in result) return c.json({ error: "not_found" }, 404);
      if ("notRecording" in result) return c.json({ error: "not_recording" }, 409);
      return c.json({
        recordingId: result.recording.id,
        status: result.recording.status,
        endedAt: result.recording.endedAt?.toISOString() ?? null,
        assets: result.assets,
      });
    } catch (e) {
      logger.error({ err: e, recordingId: c.req.param("id"), organizationId: s.organizationId }, "meeting recording finalize failed");
      return c.json({ error: "finalize_failed" }, 500);
    }
  })

  .post("/recordings/:id/abandon", async (c) => {
    const s = (await requireOrgSession(c))!;
    const result = await abandonRecording(s.organizationId, c.req.param("id"));
    if ("notFound" in result) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  })

  .get("/recordings", async (c) => {
    const s = (await requireOrgSession(c))!;
    const limit = Number(c.req.query("limit") ?? 100);
    const recordings = await listRecordings(s.organizationId, Number.isFinite(limit) ? limit : 100);
    return c.json({ recordings });
  })

  .get("/recordings/:id", async (c) => {
    const s = (await requireOrgSession(c))!;
    const recording = await getRecording(s.organizationId, c.req.param("id"));
    if (!recording) return c.json({ error: "not_found" }, 404);
    return c.json(recording);
  });
