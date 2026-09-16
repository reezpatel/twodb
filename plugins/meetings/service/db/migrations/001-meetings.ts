import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { MEETINGS_SCHEMA as S } from "..";

export const meetingsMigration: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema.createSchema(S).ifNotExists().execute();

		const schema = db.schema.withSchema(S);

		await schema
			.createTable("mt_meetings")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("title", "text", (c) => c.notNull())
			.addColumn("context", "text")
			.addColumn("status", "text", (c) => c.notNull().defaultTo("scheduled"))
			.addColumn("scheduled_start", "timestamptz")
			.addColumn("started_at", "timestamptz")
			.addColumn("ended_at", "timestamptz")
			.addColumn("created_by", "text", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await schema
			.createTable("mt_meeting_participants")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("meeting_id", "text", (c) =>
				c.references("mt_meetings.id").onDelete("cascade").notNull(),
			)
			.addColumn("user_id", "text")
			.addColumn("name", "text", (c) => c.notNull())
			.addColumn("email", "text")
			.addColumn("role", "text", (c) => c.notNull().defaultTo("participant"))
			.addColumn("state", "text", (c) => c.notNull().defaultTo("invited"))
			.addColumn("joined_at", "timestamptz")
			.addColumn("left_at", "timestamptz")
			.execute();

		// A meeting can be recorded many times (pause/resume, per-track
		// audio/video/screen captures) — every take is its own row.
		await schema
			.createTable("mt_recordings")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("meeting_id", "text", (c) =>
				c.references("mt_meetings.id").onDelete("cascade").notNull(),
			)
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("kind", "text", (c) => c.notNull())
			.addColumn("status", "text", (c) => c.notNull().defaultTo("recording"))
			.addColumn("storage_key", "text")
			.addColumn("duration_ms", "integer")
			.addColumn("size_bytes", "integer")
			.addColumn("started_by", "text", (c) => c.notNull())
			.addColumn("started_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("ended_at", "timestamptz")
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await schema
			.createTable("mt_transcript_segments")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("meeting_id", "text", (c) =>
				c.references("mt_meetings.id").onDelete("cascade").notNull(),
			)
			.addColumn("recording_id", "text", (c) =>
				c.references("mt_recordings.id").onDelete("set null"),
			)
			.addColumn("participant_id", "text", (c) =>
				c.references("mt_meeting_participants.id").onDelete("set null"),
			)
			.addColumn("speaker_name", "text", (c) => c.notNull())
			.addColumn("start_ms", "integer", (c) => c.notNull())
			.addColumn("end_ms", "integer")
			.addColumn("text", "text", (c) => c.notNull())
			.addColumn("language", "text", (c) => c.notNull().defaultTo("en"))
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await schema
			.createTable("mt_meeting_summaries")
			.addColumn("meeting_id", "text", (c) =>
				c.references("mt_meetings.id").onDelete("cascade").primaryKey(),
			)
			.addColumn("overview", "text", (c) => c.notNull())
			.addColumn("key_points", "jsonb", (c) =>
				c.notNull().defaultTo(sql`'[]'::jsonb`),
			)
			.addColumn("action_items", "jsonb", (c) =>
				c.notNull().defaultTo(sql`'[]'::jsonb`),
			)
			.addColumn("model", "text")
			.addColumn("generated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await schema
			.createIndex("mt_meetings_workspace_idx")
			.on("mt_meetings")
			.columns(["workspace_id", "created_at"])
			.execute();

		await schema
			.createIndex("mt_meeting_participants_meeting_idx")
			.on("mt_meeting_participants")
			.columns(["meeting_id"])
			.execute();

		await schema
			.createIndex("mt_recordings_meeting_idx")
			.on("mt_recordings")
			.columns(["meeting_id", "started_at"])
			.execute();

		// Workspace-level listing: "every recording taken in this workspace".
		await schema
			.createIndex("mt_recordings_workspace_idx")
			.on("mt_recordings")
			.columns(["workspace_id", "created_at"])
			.execute();

		await schema
			.createIndex("mt_transcript_segments_meeting_idx")
			.on("mt_transcript_segments")
			.columns(["meeting_id", "start_ms"])
			.execute();
	},
};
