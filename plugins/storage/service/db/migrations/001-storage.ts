import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { STORAGE_SCHEMA as S } from "..";

export const storageMigration: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema.createSchema(S).ifNotExists().execute();
		const schema = db.schema.withSchema(S);

		await schema
			.createTable("storage_locations")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("name", "text", (c) => c.notNull())
			.addColumn("kind", "text", (c) =>
				c.notNull().check(sql`kind in ('node', 's3')`),
			)
			.addColumn("node_id", "text")
			.addColumn("root_path", "text", (c) => c.notNull().defaultTo("."))
			.addColumn("bucket", "text")
			.addColumn("region", "text")
			.addColumn("endpoint", "text")
			.addColumn("prefix", "text", (c) => c.notNull().defaultTo(""))
			.addColumn("force_path_style", "boolean", (c) =>
				c.notNull().defaultTo(false),
			)
			.addColumn("credentials_encrypted", "text")
			.addColumn("created_by", "text", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await sql`
			create unique index storage_locations_ws_name_unique
			on ${sql.id(S)}.${sql.id("storage_locations")} (workspace_id, lower(name))
		`.execute(db);

		await schema
			.createTable("storage_folders")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("parent_id", "text")
			.addColumn("root_id", "text", (c) => c.notNull())
			.addColumn("location_id", "text")
			.addColumn("name", "text", (c) => c.notNull())
			.addColumn("created_by", "text", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await sql`
			alter table ${sql.id(S)}.${sql.id("storage_folders")}
			add constraint storage_folders_parent_fk
			foreign key (parent_id) references ${sql.id(S)}.${sql.id("storage_folders")} (id) on delete cascade
		`.execute(db);
		await sql`
			alter table ${sql.id(S)}.${sql.id("storage_folders")}
			add constraint storage_folders_location_fk
			foreign key (location_id) references ${sql.id(S)}.${sql.id("storage_locations")} (id)
		`.execute(db);

		await sql`
			create unique index storage_folders_ws_parent_name_unique
			on ${sql.id(S)}.${sql.id("storage_folders")} (workspace_id, coalesce(parent_id, ''), lower(name))
		`.execute(db);
		await sql`
			create index storage_folders_parent_idx
			on ${sql.id(S)}.${sql.id("storage_folders")} (workspace_id, parent_id)
		`.execute(db);

		await schema
			.createTable("storage_files")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("folder_id", "text", (c) => c.notNull())
			.addColumn("root_id", "text", (c) => c.notNull())
			.addColumn("name", "text", (c) => c.notNull())
			.addColumn("storage_key", "text", (c) => c.notNull())
			.addColumn("size", "integer", (c) => c.notNull().defaultTo(0))
			.addColumn("mime_type", "text", (c) =>
				c.notNull().defaultTo("application/octet-stream"),
			)
			.addColumn("etag", "text")
			.addColumn("last_opened_at", "timestamptz")
			.addColumn("uploaded_by", "text", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await sql`
			alter table ${sql.id(S)}.${sql.id("storage_files")}
			add constraint storage_files_folder_fk
			foreign key (folder_id) references ${sql.id(S)}.${sql.id("storage_folders")} (id) on delete cascade
		`.execute(db);

		await sql`
			create unique index storage_files_folder_name_unique
			on ${sql.id(S)}.${sql.id("storage_files")} (folder_id, lower(name))
		`.execute(db);
		await sql`
			create index storage_files_root_idx
			on ${sql.id(S)}.${sql.id("storage_files")} (root_id)
		`.execute(db);
		await sql`
			create index storage_files_ws_created_idx
			on ${sql.id(S)}.${sql.id("storage_files")} (workspace_id, created_at desc)
		`.execute(db);
	},
};
