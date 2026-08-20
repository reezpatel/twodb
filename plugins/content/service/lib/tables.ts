import { sql, type Kysely, type Transaction } from "kysely";
import type { ContentColumnConfig } from "@twodb/contracts";
import { CONTENT_SCHEMA } from "../db";
import { COLUMN_REGISTRY } from "./columns/registry";

/**
 * Runtime DDL for section props tables (plan §3.4, §6). Always runs on the
 * UNSCOCOPED db handle with explicit .withSchema(CONTENT_SCHEMA) — the
 * WithSchemaPlugin doesn't cover schema-builder edge cases. Table and column
 * names are server-generated (sec_<node>_props / col_<random>), never user
 * input.
 */

export async function createPropsTable<DB>(
	db: Kysely<DB> | Transaction<DB>,
	table: string,
): Promise<void> {
	await db.schema
		.withSchema(CONTENT_SCHEMA)
		.createTable(table)
		.addColumn("note_id", "text", (c) =>
			c.primaryKey().references("content_notes.id").onDelete("cascade"),
		)
		.addColumn("workspace_id", "text", (c) => c.notNull())
		.execute();
}

export async function dropPropsTable<DB>(
	db: Kysely<DB> | Transaction<DB>,
	table: string,
): Promise<void> {
	await db.schema
		.withSchema(CONTENT_SCHEMA)
		.dropTable(table)
		.ifExists()
		.execute();
}

export async function addPropsColumn<DB>(
	db: Kysely<DB> | Transaction<DB>,
	table: string,
	column: string,
	type: keyof typeof COLUMN_REGISTRY,
): Promise<void> {
	await db.schema
		.withSchema(CONTENT_SCHEMA)
		.alterTable(table)
		.addColumn(column, COLUMN_REGISTRY[type].pgType)
		.execute();
}

export async function dropPropsColumn<DB>(
	db: Kysely<DB> | Transaction<DB>,
	table: string,
	column: string,
): Promise<void> {
	await db.schema
		.withSchema(CONTENT_SCHEMA)
		.alterTable(table)
		.dropColumn(column)
		.execute();
}

/** Best-effort retype: values that don't convert become NULL (plan §4). */
export async function retypePropsColumn<DB>(
	db: Kysely<DB> | Transaction<DB>,
	table: string,
	column: string,
	target: keyof typeof COLUMN_REGISTRY,
	config?: ContentColumnConfig,
): Promise<void> {
	const entry = COLUMN_REGISTRY[target];
	const using = entry.castSql(column, config);
	await sql`
		alter table ${sql.id(CONTENT_SCHEMA)}.${sql.id(table)}
		alter column ${sql.id(column)}
		type ${sql.raw(entry.pgType)}
		using ${using}
	`.execute(db);
}
