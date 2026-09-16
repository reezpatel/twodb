import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { CALENDAR_SCHEMA as S } from "..";

export const calendarMigration: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema.createSchema(S).ifNotExists().execute();

		const schema = db.schema.withSchema(S);

		await schema
			.createTable("cal_accounts")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("provider", "text", (c) => c.notNull())
			.addColumn("label", "text", (c) => c.notNull())
			.addColumn("email", "text")
			.addColumn("status", "text", (c) => c.notNull().defaultTo("pending"))
			.addColumn("credentials", "text")
			.addColumn("remote_url", "text")
			.addColumn("sync_cursor", "text")
			.addColumn("last_synced_at", "timestamptz")
			.addColumn("error", "text")
			.addColumn("created_by", "text", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await schema
			.createTable("cal_calendars")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("account_id", "text", (c) =>
				c.references("cal_accounts.id").onDelete("cascade").notNull(),
			)
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("remote_id", "text")
			.addColumn("name", "text", (c) => c.notNull())
			.addColumn("color", "text")
			.addColumn("read_only", "boolean", (c) => c.notNull().defaultTo(false))
			.addColumn("is_primary", "boolean", (c) => c.notNull().defaultTo(false))
			.addColumn("visible", "boolean", (c) => c.notNull().defaultTo(true))
			.addColumn("position", "float8", (c) => c.notNull().defaultTo(0))
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await schema
			.createTable("cal_events")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("calendar_id", "text", (c) =>
				c.references("cal_calendars.id").onDelete("cascade").notNull(),
			)
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("remote_id", "text")
			.addColumn("etag", "text")
			.addColumn("title", "text", (c) => c.notNull())
			.addColumn("description", "text")
			.addColumn("location", "text")
			.addColumn("conferencing_url", "text")
			.addColumn("start_at", "timestamptz", (c) => c.notNull())
			.addColumn("end_at", "timestamptz", (c) => c.notNull())
			.addColumn("all_day", "boolean", (c) => c.notNull().defaultTo(false))
			.addColumn("timezone", "text")
			.addColumn("rrule", "text")
			.addColumn("exdates", "jsonb", (c) =>
				c.notNull().defaultTo(sql`'[]'::jsonb`),
			)
			.addColumn("status", "text", (c) => c.notNull().defaultTo("confirmed"))
			.addColumn("organizer_email", "text")
			.addColumn("created_by", "text", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await schema
			.createTable("cal_event_attendees")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("event_id", "text", (c) =>
				c.references("cal_events.id").onDelete("cascade").notNull(),
			)
			.addColumn("email", "text", (c) => c.notNull())
			.addColumn("name", "text")
			.addColumn("role", "text", (c) => c.notNull().defaultTo("required"))
			.addColumn("rsvp", "text", (c) => c.notNull().defaultTo("needs_action"))
			.execute();

		await schema
			.createTable("cal_event_reminders")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("event_id", "text", (c) =>
				c.references("cal_events.id").onDelete("cascade").notNull(),
			)
			.addColumn("method", "text", (c) => c.notNull().defaultTo("popup"))
			.addColumn("minutes_before", "integer", (c) => c.notNull())
			.execute();

		await schema
			.createIndex("cal_accounts_workspace_idx")
			.on("cal_accounts")
			.columns(["workspace_id"])
			.execute();

		await schema
			.createIndex("cal_calendars_account_idx")
			.on("cal_calendars")
			.columns(["account_id", "position"])
			.execute();

		// Remote events are idempotent per calendar for sync upserts.
		await sql`
			create unique index cal_calendars_remote_unique
			on ${sql.id(S)}.${sql.id("cal_calendars")} (account_id, remote_id)
			where remote_id is not null
		`.execute(db);

		await sql`
			create unique index cal_events_remote_unique
			on ${sql.id(S)}.${sql.id("cal_events")} (calendar_id, remote_id)
			where remote_id is not null
		`.execute(db);

		await schema
			.createIndex("cal_events_range_idx")
			.on("cal_events")
			.columns(["calendar_id", "start_at", "end_at"])
			.execute();

		await schema
			.createIndex("cal_event_attendees_event_idx")
			.on("cal_event_attendees")
			.columns(["event_id"])
			.execute();

		await schema
			.createIndex("cal_event_reminders_event_idx")
			.on("cal_event_reminders")
			.columns(["event_id"])
			.execute();
	},
};
