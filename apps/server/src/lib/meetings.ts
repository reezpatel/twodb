import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { db } from "../auth";
import { logger } from "./logger";
import { getStorageDestinations } from "./server-settings";
import { getStorageDriver } from "./storage/registry";
import type { StorageDriver } from "./storage/driver";
import type { MeetingRecordingTable, MeetingRecordingTrackTable } from "../plugins/db";

// Meeting-recording ingestion: chunks spool to a temp file per track, and at
// finalize the whole track uploads through the meeting_recordings storage
// destination (S3 or local backend, chosen in server settings). Sequences are
// strictly ordered per track — nextSeq doubles as the dedupe registry.

export const TRACK_IDS = new Set(["meeting", "screen"]);
const MAX_CHUNK_BYTES = 16 * 1024 * 1024;
const MAX_TRACK_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB spool cap per track
function spoolRoot(): string {
  return process.env.TWODB_MEETING_SPOOL_DIR ?? path.join(os.tmpdir(), "twodb-meeting-spool");
}

function trackSpoolPath(recordingId: string, trackId: string): string {
  return path.join(spoolRoot(), `${recordingId}.${trackId}.webm`);
}

async function appendSpool(recordingId: string, trackId: string, bytes: Buffer): Promise<number> {
  const file = trackSpoolPath(recordingId, trackId);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.appendFile(file, bytes);
  const stat = await fsp.stat(file);
  return stat.size;
}

async function removeSpool(recordingId: string, trackIds: string[]): Promise<void> {
  await Promise.all(
    trackIds.map((trackId) =>
      fsp.rm(trackSpoolPath(recordingId, trackId), { force: true }).catch(() => undefined),
    ),
  );
}

export interface StartTrackInput {
  trackId: string;
  durationMs?: number | null;
  startedAt?: string | null;
}

export interface StartedRecording {
  recording: MeetingRecordingTable;
  tracks: MeetingRecordingTrackTable[];
  resumed: boolean;
}

export async function startRecording(
  organizationId: string,
  input: { platform: string; title?: string | null; meetingUrl?: string | null; clientSessionId?: string | null; tracks: StartTrackInput[] },
): Promise<StartedRecording> {
  const trackIds = (input.tracks ?? []).map((t) => t.trackId).filter((t) => TRACK_IDS.has(t));
  if (trackIds.length === 0) throw new Error("no_valid_tracks");

  if (input.clientSessionId) {
    const existing = await db
      .selectFrom("meeting_recording")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("clientSessionId", "=", input.clientSessionId)
      .where("status", "=", "recording")
      .executeTakeFirst();
    if (existing) {
      const tracks = await db
        .selectFrom("meeting_recording_track")
        .selectAll()
        .where("recordingId", "=", existing.id)
        .execute();
      logger.info({ recordingId: existing.id, organizationId }, "meeting recording resumed");
      return { recording: existing, tracks, resumed: true };
    }
  }

  const now = new Date();
  const id = crypto.randomUUID();
  const recording = await db
    .insertInto("meeting_recording")
    .values({
      id,
      organizationId,
      platform: input.platform,
      title: input.title ?? null,
      meetingUrl: input.meetingUrl ?? null,
      clientSessionId: input.clientSessionId ?? null,
      status: "recording",
      startedAt: now,
      endedAt: null,
      lastHeartbeatAt: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const tracks = await Promise.all(
    [...new Set(trackIds)].map(async (trackId) => {
      const startedAt = input.tracks.find((t) => t.trackId === trackId)?.startedAt;
      return db
        .insertInto("meeting_recording_track")
        .values({
          id: crypto.randomUUID(),
          recordingId: id,
          organizationId,
          trackId,
          nextSeq: 1,
          receivedChunks: 0,
          receivedBytes: 0,
          durationMs: null,
          trackStartedAt: startedAt ? new Date(startedAt) : now,
          mediaAssetId: null,
          createdAt: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }),
  );

  logger.info({ recordingId: id, organizationId, platform: input.platform, tracks: trackIds }, "meeting recording started");
  return { recording, tracks, resumed: false };
}

export interface ChunkResult {
  nextSeq: number;
  receivedBytes: number;
}

export async function appendChunk(
  organizationId: string,
  recordingId: string,
  trackId: string,
  seq: number,
  bytes: Buffer,
  checksum?: string,
): Promise<ChunkResult | { conflict: { expectedSeq: number } } | { tooLarge: true } | { notFound: true } | { notRecording: true }> {
  const track = await db
    .selectFrom("meeting_recording_track")
    .selectAll()
    .where("recordingId", "=", recordingId)
    .where("organizationId", "=", organizationId)
    .where("trackId", "=", trackId)
    .executeTakeFirst();
  if (!track) return { notFound: true };

  const recording = await db
    .selectFrom("meeting_recording")
    .select(["status"])
    .where("id", "=", recordingId)
    .executeTakeFirst();
  if (!recording || recording.status !== "recording") return { notRecording: true };

  if (!Number.isInteger(seq) || seq < 1) return { conflict: { expectedSeq: track.nextSeq } };
  if (bytes.length === 0) return { conflict: { expectedSeq: track.nextSeq } };
  if (bytes.length > MAX_CHUNK_BYTES) return { tooLarge: true };
  if (checksum && createHash("sha256").update(bytes).digest("hex") !== checksum) {
    return { conflict: { expectedSeq: track.nextSeq } };
  }
  if (seq !== track.nextSeq) return { conflict: { expectedSeq: track.nextSeq } };
  if (track.receivedBytes + bytes.length > MAX_TRACK_BYTES) return { tooLarge: true };

  const size = await appendSpool(recordingId, trackId, bytes);
  const now = new Date();
  await db
    .updateTable("meeting_recording_track")
    .set({ nextSeq: seq + 1, receivedChunks: track.receivedChunks + 1, receivedBytes: size })
    .where("id", "=", track.id)
    .execute();
  await db.updateTable("meeting_recording").set({ lastHeartbeatAt: now }).where("id", "=", recordingId).execute();

  return { nextSeq: seq + 1, receivedBytes: size };
}

async function destinationForTrack(): Promise<{ backendId: string; prefix: string; driver: StorageDriver }> {
  const destinations = await getStorageDestinations();
  const destination = destinations["meeting_recordings"];
  if (!destination) throw new Error("meeting_recordings destination not configured");
  const { backend, driver } = await getStorageDriver(destination.backendId);
  return { backendId: backend.id, prefix: destination.prefix, driver };
}

export interface FinalizeTrackInput {
  trackId: string;
  totalChunks?: number;
  durationMs?: number | null;
  startedAt?: string | null;
}

export interface FinalizedAsset {
  trackId: string;
  mediaAssetId: string;
  uri: string;
  path: string;
  size: number;
}

export async function finalizeRecording(
  organizationId: string,
  recordingId: string,
  trackInputs: FinalizeTrackInput[],
): Promise<{ recording: MeetingRecordingTable; assets: FinalizedAsset[] } | { notFound: true } | { notRecording: true }> {
  const recording = await db
    .selectFrom("meeting_recording")
    .selectAll()
    .where("id", "=", recordingId)
    .where("organizationId", "=", organizationId)
    .executeTakeFirst();
  if (!recording) return { notFound: true };
  if (recording.status !== "recording") return { notRecording: true };

  const tracks = await db
    .selectFrom("meeting_recording_track")
    .selectAll()
    .where("recordingId", "=", recordingId)
    .execute();

  const { backendId, prefix, driver } = await destinationForTrack();

  const date = recording.startedAt.toISOString().slice(0, 10);
  const dir = [prefix, date, recordingId].filter(Boolean).join("/");
  const assets: FinalizedAsset[] = [];

  for (const track of tracks) {
    const input = trackInputs.find((t) => t.trackId === track.trackId) ?? ({} as Partial<FinalizeTrackInput>);
    const spoolFile = trackSpoolPath(recordingId, track.trackId);
    let body: Buffer;
    try {
      body = await fsp.readFile(spoolFile);
    } catch {
      body = Buffer.alloc(0);
    }
    const objectPath = `${dir}/${track.trackId}.webm`;
    await driver.put(objectPath, body, "video/webm");

    const durationMs = input.durationMs ?? track.durationMs ?? null;
    const trackStartedAt = input.startedAt ? new Date(input.startedAt) : track.trackStartedAt;

    const mediaId = crypto.randomUUID();
    await db
      .insertInto("media_asset")
      .values({
        id: mediaId,
        organizationId,
        sessionId: null,
        chatChannelId: null,
        backendId,
        path: objectPath,
        filename: `${recording.title ?? recording.platform}-${track.trackId}.webm`,
        extension: "webm",
        contentType: "video/webm",
        size: body.length,
        createdAt: new Date(),
      })
      .execute();

    await db
      .updateTable("meeting_recording_track")
      .set({ durationMs, trackStartedAt, mediaAssetId: mediaId })
      .where("id", "=", track.id)
      .execute();

    assets.push({ trackId: track.trackId, mediaAssetId: mediaId, uri: `twodb://${backendId}/${mediaId}`, path: objectPath, size: body.length });
  }

  const metadataEndedAt = new Date();
  const metadata = {
    platform: recording.platform,
    title: recording.title,
    meetingUrl: recording.meetingUrl,
    recordingId,
    startedAt: recording.startedAt.toISOString(),
    endedAt: metadataEndedAt.toISOString(),
    tracks: tracks.map((t) => {
      const input = trackInputs.find((x) => x.trackId === t.trackId);
      return {
        trackId: t.trackId,
        startedAt: (input?.startedAt ? new Date(input.startedAt) : t.trackStartedAt)?.toISOString() ?? null,
        durationMs: input?.durationMs ?? t.durationMs ?? null,
        size: assets.find((a) => a.trackId === t.trackId)?.size ?? 0,
        chunks: input?.totalChunks ?? t.receivedChunks,
      };
    }),
  };
  await driver.put(`${dir}/metadata.json`, Buffer.from(JSON.stringify(metadata, null, 2)), "application/json");

  const endedAt = new Date();
  const finalized = await db
    .updateTable("meeting_recording")
    .set({ status: "finalized", endedAt, lastHeartbeatAt: endedAt })
    .where("id", "=", recordingId)
    .returningAll()
    .executeTakeFirstOrThrow();

  await removeSpool(recordingId, tracks.map((t) => t.trackId));

  logger.info({ recordingId, organizationId, assets: assets.length, bytes: assets.reduce((n, a) => n + a.size, 0) }, "meeting recording finalized");
  return { recording: finalized, assets };
}

export async function abandonRecording(
  organizationId: string,
  recordingId: string,
): Promise<{ ok: true } | { notFound: true }> {
  const recording = await db
    .selectFrom("meeting_recording")
    .selectAll()
    .where("id", "=", recordingId)
    .where("organizationId", "=", organizationId)
    .executeTakeFirst();
  if (!recording) return { notFound: true };

  const tracks = await db.selectFrom("meeting_recording_track").select(["trackId"]).where("recordingId", "=", recordingId).execute();
  await removeSpool(recordingId, tracks.map((t) => t.trackId));
  await db
    .updateTable("meeting_recording")
    .set({ status: "abandoned", endedAt: new Date() })
    .where("id", "=", recordingId)
    .execute();
  logger.info({ recordingId, organizationId }, "meeting recording abandoned");
  return { ok: true };
}

export async function heartbeatRecording(organizationId: string, recordingId: string): Promise<boolean> {
  const now = new Date();
  const row = await db
    .updateTable("meeting_recording")
    .set({ lastHeartbeatAt: now })
    .where("id", "=", recordingId)
    .where("organizationId", "=", organizationId)
    .where("status", "=", "recording")
    .returning("id")
    .executeTakeFirst();
  return !!row;
}

export interface RecordingSummary {
  id: string;
  platform: string;
  title: string | null;
  meetingUrl: string | null;
  status: MeetingRecordingTable["status"];
  startedAt: string;
  endedAt: string | null;
  tracks: { trackId: string; durationMs: number | null; bytes: number; mediaAssetId: string | null; uri: string | null }[];
}

export async function listRecordings(organizationId: string, limit = 100): Promise<RecordingSummary[]> {
  const recordings = await db
    .selectFrom("meeting_recording")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .orderBy("startedAt", "desc")
    .limit(Math.min(Math.max(limit, 1), 200))
    .execute();
  if (recordings.length === 0) return [];

  const tracks = await db
    .selectFrom("meeting_recording_track")
    .selectAll()
    .where("recordingId", "in", recordings.map((r) => r.id))
    .execute();

  return recordings.map((r) => ({
    id: r.id,
    platform: r.platform,
    title: r.title,
    meetingUrl: r.meetingUrl,
    status: r.status,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt?.toISOString() ?? null,
    tracks: tracks
      .filter((t) => t.recordingId === r.id)
      .map((t) => ({
        trackId: t.trackId,
        durationMs: t.durationMs,
        bytes: Number(t.receivedBytes),
        mediaAssetId: t.mediaAssetId,
        uri: t.mediaAssetId ? `twodb://${t.mediaAssetId}` : null,
      })),
  }));
}

export async function getRecording(organizationId: string, recordingId: string): Promise<RecordingSummary | null> {
  const recording = await db
    .selectFrom("meeting_recording")
    .selectAll()
    .where("id", "=", recordingId)
    .where("organizationId", "=", organizationId)
    .executeTakeFirst();
  if (!recording) return null;

  const tracks = await db.selectFrom("meeting_recording_track").selectAll().where("recordingId", "=", recordingId).execute();
  const backendByAsset = new Map<string, string>();
  if (tracks.some((t) => t.mediaAssetId)) {
    const assets = await db
      .selectFrom("media_asset")
      .select(["id", "backendId"])
      .where("id", "in", tracks.filter((t) => t.mediaAssetId).map((t) => t.mediaAssetId!))
      .execute();
    for (const a of assets) backendByAsset.set(a.id, a.backendId);
  }

  return {
    id: recording.id,
    platform: recording.platform,
    title: recording.title,
    meetingUrl: recording.meetingUrl,
    status: recording.status,
    startedAt: recording.startedAt.toISOString(),
    endedAt: recording.endedAt?.toISOString() ?? null,
    tracks: tracks.map((t) => ({
      trackId: t.trackId,
      durationMs: t.durationMs,
      bytes: Number(t.receivedBytes),
      mediaAssetId: t.mediaAssetId,
      uri: t.mediaAssetId && backendByAsset.has(t.mediaAssetId) ? `twodb://${backendByAsset.get(t.mediaAssetId)}/${t.mediaAssetId}` : null,
    })),
  };
}
