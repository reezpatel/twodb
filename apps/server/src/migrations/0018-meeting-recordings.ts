import type { Migration } from "kysely/migration";
import { db } from "../auth";

/**
 * Meeting recorder: one recording per captured meeting, one track per capture
 * stream (meeting tab + optional dedicated screen). Chunks are strictly
 * sequential per track (nextSeq); bytes spool on the server and land in the
 * meeting_recordings storage destination at finalize, recorded as media_asset
 * rows. clientSessionId lets the extension resume a crashed upload.
 */
export const up: Migration["up"] = async () => {
  const foreignKey = (table: string, name: string, columns: string[], refTable: string, onDelete?: "cascade" | "set null") =>
    db.schema
      .alterTable(table)
      .addForeignKeyConstraint(name, columns, refTable, ["id"], (c) => (onDelete ? c.onDelete(onDelete) : c))
      .execute();
  const index = (name: string, table: string, columns: string[]) => db.schema.createIndex(name).on(table).columns(columns).execute();

  await db.schema
    .createTable("meeting_recording")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("platform", "text", (c) => c.notNull())
    .addColumn("title", "text")
    .addColumn("meetingUrl", "text")
    .addColumn("clientSessionId", "text")
    .addColumn("status", "text", (c) => c.defaultTo("recording").notNull())
    .addColumn("startedAt", "timestamptz", (c) => c.notNull())
    .addColumn("endedAt", "timestamptz")
    .addColumn("lastHeartbeatAt", "timestamptz")
    .execute();
  await foreignKey("meeting_recording", "meeting_recording_org_fk", ["organizationId"], "organization");
  await index("meeting_recording_org_idx", "meeting_recording", ["organizationId"]);
  await index("meeting_recording_client_session_idx", "meeting_recording", ["organizationId", "clientSessionId"]);

  await db.schema
    .createTable("meeting_recording_track")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("recordingId", "text", (c) => c.notNull())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("trackId", "text", (c) => c.notNull())
    .addColumn("nextSeq", "integer", (c) => c.defaultTo(1).notNull())
    .addColumn("receivedChunks", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("receivedBytes", "bigint", (c) => c.defaultTo(0).notNull())
    .addColumn("durationMs", "integer")
    .addColumn("trackStartedAt", "timestamptz")
    .addColumn("mediaAssetId", "text")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();
  await foreignKey("meeting_recording_track", "meeting_recording_track_recording_fk", ["recordingId"], "meeting_recording", "cascade");
  await foreignKey("meeting_recording_track", "meeting_recording_track_org_fk", ["organizationId"], "organization");
  await index("meeting_recording_track_recording_idx", "meeting_recording_track", ["recordingId"]);
  await db.schema
    .createIndex("meeting_recording_track_recording_track_uq")
    .unique()
    .on("meeting_recording_track")
    .columns(["recordingId", "trackId"])
    .execute();
};

export const down: Migration["down"] = async () => {
  await db.schema.dropTable("meeting_recording_track").execute();
  await db.schema.dropTable("meeting_recording").execute();
};
