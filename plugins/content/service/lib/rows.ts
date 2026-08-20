import { sql, type Kysely, type RawBuilder, type Selectable } from "kysely";
import type {
	ContentAttachment,
	ContentColumnConfig,
	ContentColumnType,
	ContentFilter,
	ContentLink,
	ContentRowDto,
	ContentSort,
	ContentTag,
} from "@twodb/contracts";
import { newId } from "@twodb/shared-backend";
import { CONTENT_SCHEMA } from "../db";
import type { ContentDB, ContentNotesTable } from "../db/schema";
import { COLUMN_REGISTRY } from "./columns/registry";
import { propsTableName, type ContentNode } from "./tree";
import { jsonb } from "./serialize";

export class RowError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
	}
}

type NoteRow = Selectable<ContentNotesTable>;

const CORE_REFS: Record<string, ContentColumnType> = {
	title: "text",
	content: "text",
	completed: "checkbox",
	position: "number",
	created_at: "date",
	updated_at: "date",
};

const POSITION_GAP = 1024;

function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** SQL ref + registry type for a filter/sort column id. */
function refFor(
	node: ContentNode,
	columnId: string,
): { ref: RawBuilder<unknown>; type: ContentColumnType } {
	const core = CORE_REFS[columnId];
	if (core) return { ref: sql.ref(`n.${columnId}`), type: core };
	const config = (node.columns_config ?? []).find(
		(c) => c.column_id === columnId,
	);
	if (!config) throw new RowError(400, `Unknown column "${columnId}".`);
	return { ref: sql.ref(`p.${columnId}`), type: config.type };
}

function condition(
	node: ContentNode,
	filter: ContentFilter,
): RawBuilder<boolean> {
	const { ref, type } = refFor(node, filter.column_id);
	const entry = COLUMN_REGISTRY[type];
	const op = filter.op;

	if (op === "is_empty") return sql<boolean>`${ref} is null`;
	if (op === "is_not_empty") return sql<boolean>`${ref} is not null`;

	if (op === "contains" || op === "not_contains") {
		const raw = filter.value;
		if (type === "multi_select") {
			if (typeof raw !== "string") {
				throw new RowError(400, `Bad filter value for "${filter.column_id}".`);
			}
			const contains = sql<boolean>`coalesce(${ref}, '[]'::jsonb) @> to_jsonb(${raw}::text)`;
			return op === "contains" ? contains : sql<boolean>`not ${contains}`;
		}
		if (typeof raw !== "string") {
			throw new RowError(400, `Bad filter value for "${filter.column_id}".`);
		}
		const pattern = `%${escapeLike(raw)}%`;
		const contains = sql<boolean>`coalesce(${ref}::text, '') ilike ${pattern}`;
		return op === "contains" ? contains : sql<boolean>`not ${contains}`;
	}

	// Comparison ops: coerce the value against the column's registry type.
	const coerced = entry.coerce(filter.value, undefined);
	if (!coerced.ok || coerced.value === null) {
		throw new RowError(400, `Bad filter value for "${filter.column_id}".`);
	}
	const value =
		entry.pgType === "jsonb"
			? sql`${sql.val(coerced.value)}::jsonb`
			: sql.val(coerced.value);
	switch (op) {
		case "is":
			return sql<boolean>`${ref} = ${value}`;
		case "is_not":
			return sql<boolean>`${ref} is distinct from ${value}`;
		case "gt":
			return sql<boolean>`${ref} > ${value}`;
		case "lt":
			return sql<boolean>`${ref} < ${value}`;
		case "gte":
			return sql<boolean>`${ref} >= ${value}`;
		case "lte":
			return sql<boolean>`${ref} <= ${value}`;
		default:
			throw new RowError(400, `Unknown filter op "${op}".`);
	}
}

export interface ListRowsQuery {
	filters?: ContentFilter[];
	sorts?: ContentSort[];
	search?: string;
	limit?: number;
	cursor?: string;
	includeDeleted?: boolean;
}

export interface ListRowsResult {
	rows: ContentRowDto[];
	next_cursor: string | null;
}

function decodeCursor(cursor: string | undefined): number {
	if (!cursor) return 0;
	const offset = Number(Buffer.from(cursor, "base64").toString("utf8"));
	if (!Number.isInteger(offset) || offset < 0) {
		throw new RowError(400, "Bad cursor.");
	}
	return offset;
}

export async function listRows(
	db: Kysely<ContentDB>,
	node: ContentNode,
	query: ListRowsQuery,
): Promise<ListRowsResult> {
	const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
	const offset = decodeCursor(query.cursor);
	const config = node.columns_config ?? [];
	const propsTable = sql`${sql.id(CONTENT_SCHEMA)}.${sql.id(propsTableName(node.id))}`;

	// Dynamic props join: core row (n) + lazily-created props row (p).
	// The props table is inherently untyped (runtime DDL), hence the casts.
	let qb = db
		.selectFrom("content_notes as n")
		.leftJoin(propsTable.as("p") as never as "content_notes", (join) =>
			join.on(sql<boolean>`p.note_id = n.id`),
		)
		.selectAll("n")
		.select(
			config.map(
				(c) => sql`${sql.ref(`p.${c.column_id}`)}`.as(c.column_id) as never,
			),
		)
		.where("n.workspace_id", "=", node.workspace_id)
		.where("n.section_id", "=", node.id);

	if (!query.includeDeleted) qb = qb.where("n.deleted", "=", false);
	for (const filter of query.filters ?? []) {
		qb = qb.where(condition(node, filter));
	}
	if (query.search?.trim()) {
		const pattern = `%${escapeLike(query.search.trim())}%`;
		qb = qb.where((eb) =>
			eb.or([
				eb("n.title", "ilike", pattern),
				eb("n.content", "ilike", pattern),
			]),
		);
	}
	const sorts = query.sorts ?? [];
	if (sorts.length === 0) {
		qb = qb.orderBy("n.position", "asc").orderBy("n.id", "asc");
	} else {
		for (const sort of sorts) {
			const { ref } = refFor(node, sort.column_id);
			qb = qb.orderBy(ref, sort.dir === "desc" ? "desc" : "asc");
		}
		qb = qb.orderBy("n.id", "asc");
	}

	const records = (await qb
		.limit(limit + 1)
		.offset(offset)
		.execute()) as (NoteRow & Record<string, unknown>)[];
	const page = records.slice(0, limit);
	return {
		rows: page.map((row) => serializeRow(row, row, config)),
		next_cursor:
			records.length > limit
				? Buffer.from(String(offset + limit), "utf8").toString("base64")
				: null,
	};
}

export function serializeRow(
	note: NoteRow,
	props: Record<string, unknown> | undefined,
	config: ContentColumnConfig[],
): ContentRowDto {
	const values: Record<string, unknown> = {};
	for (const column of config) {
		const raw = props?.[column.column_id];
		values[column.column_id] =
			raw instanceof Date ? raw.toISOString() : (raw ?? null);
	}
	return {
		id: note.id,
		section_id: note.section_id,
		workspace_id: note.workspace_id,
		title: note.title,
		content: note.content,
		completed: note.completed,
		deleted: note.deleted,
		position: note.position,
		tags: note.tags,
		links: note.links,
		attachments: note.attachments,
		created_by: note.created_by,
		created_at: note.created_at.toISOString(),
		updated_at: note.updated_at.toISOString(),
		values,
	};
}

export async function getRow(
	db: Kysely<ContentDB>,
	node: ContentNode,
	rowId: string,
): Promise<ContentRowDto | null> {
	const note = await db
		.selectFrom("content_notes")
		.selectAll()
		.where("id", "=", rowId)
		.where("section_id", "=", node.id)
		.where("workspace_id", "=", node.workspace_id)
		.executeTakeFirst();
	if (!note) return null;
	const props = await fetchProps(db, node, [rowId]);
	return serializeRow(note, props.get(rowId), node.columns_config ?? []);
}

async function fetchProps(
	db: Kysely<ContentDB>,
	node: ContentNode,
	noteIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
	const map = new Map<string, Record<string, unknown>>();
	if (noteIds.length === 0 || (node.columns_config ?? []).length === 0) {
		return map;
	}
	const table = propsTableName(node.id);
	const rows = await sql<Record<string, unknown>>`
		select * from ${sql.id(CONTENT_SCHEMA)}.${sql.id(table)}
		where note_id = any (${sql.val(noteIds)}::text[])
	`.execute(db);
	for (const row of rows.rows) {
		map.set(row.note_id as string, row);
	}
	return map;
}

// --- mutations ------------------------------------------------------------

function validateTags(value: unknown): ContentTag[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) throw new RowError(400, "tags must be an array.");
	for (const tag of value) {
		if (typeof tag?.label !== "string") {
			throw new RowError(400, "Each tag needs a label string.");
		}
	}
	return value as ContentTag[];
}

function validateLinks(value: unknown): ContentLink[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) throw new RowError(400, "links must be an array.");
	for (const link of value) {
		if (
			!["note", "node", "url"].includes(link?.kind) ||
			typeof link?.target !== "string" ||
			typeof link?.label !== "string"
		) {
			throw new RowError(400, "Each link needs kind, target and label.");
		}
	}
	return value as ContentLink[];
}

function validateAttachments(value: unknown): ContentAttachment[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) {
		throw new RowError(400, "attachments must be an array.");
	}
	for (const att of value) {
		if (typeof att?.name !== "string" || typeof att?.url !== "string") {
			throw new RowError(400, "Each attachment needs name and url.");
		}
	}
	return value as ContentAttachment[];
}

/** Validate + coerce user-column values against the section schema. */
function coerceValues(
	node: ContentNode,
	values: unknown,
): Record<string, unknown> {
	if (values === undefined) return {};
	if (typeof values !== "object" || values === null || Array.isArray(values)) {
		throw new RowError(400, "values must be an object keyed by column_id.");
	}
	const out: Record<string, unknown> = {};
	for (const [columnId, value] of Object.entries(values)) {
		const config = (node.columns_config ?? []).find(
			(c) => c.column_id === columnId,
		);
		if (!config) throw new RowError(400, `Unknown column "${columnId}".`);
		const coerced = COLUMN_REGISTRY[config.type].coerce(value, config);
		if (!coerced.ok) {
			throw new RowError(400, `Bad value for column "${columnId}".`);
		}
		out[columnId] = coerced.value;
	}
	return out;
}

export interface RowInput {
	title?: string;
	content?: string;
	completed?: boolean;
	deleted?: boolean;
	position?: number;
	tags?: unknown;
	links?: unknown;
	attachments?: unknown;
	values?: unknown;
}

export async function createRow(
	db: Kysely<ContentDB>,
	node: ContentNode,
	userId: string,
	input: RowInput,
): Promise<ContentRowDto> {
	const values = coerceValues(node, input.values);
	const tags = validateTags(input.tags);
	const links = validateLinks(input.links);
	const attachments = validateAttachments(input.attachments);

	const position =
		input.position ??
		((
			await db
				.selectFrom("content_notes")
				.select("position")
				.where("section_id", "=", node.id)
				.orderBy("position", "desc")
				.limit(1)
				.executeTakeFirst()
		)?.position ?? 0) + POSITION_GAP;

	const id = newId("nte");
	const note = await db
		.insertInto("content_notes")
		.values({
			id,
			workspace_id: node.workspace_id,
			section_id: node.id,
			title: input.title ?? "",
			content: input.content ?? "",
			completed: input.completed ?? false,
			position,
			tags: jsonb(tags),
			links: jsonb(links),
			attachments: jsonb(attachments),
			created_by: userId,
		})
		.returningAll()
		.executeTakeFirstOrThrow();

	if (Object.keys(values).length > 0) {
		await upsertProps(db, node, id, values, false);
	}
	const props = await fetchProps(db, node, [id]);
	return serializeRow(note, props.get(id), node.columns_config ?? []);
}

export async function updateRow(
	db: Kysely<ContentDB>,
	node: ContentNode,
	rowId: string,
	input: RowInput,
): Promise<ContentRowDto | null> {
	const values = coerceValues(node, input.values);
	const patch: Record<string, unknown> = { updated_at: new Date() };
	if (input.title !== undefined) patch.title = input.title;
	if (input.content !== undefined) patch.content = input.content;
	if (input.completed !== undefined) patch.completed = input.completed;
	if (input.deleted !== undefined) patch.deleted = input.deleted;
	if (input.position !== undefined) patch.position = input.position;
	if (input.tags !== undefined) patch.tags = jsonb(validateTags(input.tags));
	if (input.links !== undefined)
		patch.links = jsonb(validateLinks(input.links));
	if (input.attachments !== undefined) {
		patch.attachments = jsonb(validateAttachments(input.attachments));
	}

	const note = await db
		.updateTable("content_notes")
		.set(patch)
		.where("id", "=", rowId)
		.where("section_id", "=", node.id)
		.where("workspace_id", "=", node.workspace_id)
		.returningAll()
		.executeTakeFirst();
	if (!note) return null;
	if (Object.keys(values).length > 0) {
		await upsertProps(db, node, rowId, values, true);
	}
	const props = await fetchProps(db, node, [rowId]);
	return serializeRow(note, props.get(rowId), node.columns_config ?? []);
}

/** Lazy props rows (plan §3.4): insert on first value, update after. */
async function upsertProps(
	db: Kysely<ContentDB>,
	node: ContentNode,
	noteId: string,
	values: Record<string, unknown>,
	isUpdate: boolean,
): Promise<void> {
	const config = node.columns_config ?? [];
	const table = sql.id(CONTENT_SCHEMA, propsTableName(node.id));
	const columns = Object.keys(values);
	const bindings = columns.map((columnId) => {
		const type = config.find((c) => c.column_id === columnId)?.type;
		const value = values[columnId];
		if (value === null) return sql`null`;
		return type && COLUMN_REGISTRY[type].pgType === "jsonb"
			? sql`${sql.val(value)}::jsonb`
			: sql.val(value);
	});
	const columnList = sql.join(columns.map((c) => sql.id(c)));

	if (!isUpdate) {
		await sql`
			insert into ${table} (note_id, workspace_id, ${columnList})
			values (${noteId}, ${node.workspace_id}, ${sql.join(bindings)})
		`.execute(db);
		return;
	}
	const assignments = sql.join(
		columns.map((c, i) => sql`${sql.id(c)} = ${bindings[i]}`),
	);
	await sql`
		insert into ${table} (note_id, workspace_id, ${columnList})
		values (${noteId}, ${node.workspace_id}, ${sql.join(bindings)})
		on conflict (note_id) do update set ${assignments}
	`.execute(db);
}

export async function deleteRow(
	db: Kysely<ContentDB>,
	node: ContentNode,
	rowId: string,
	hard: boolean,
): Promise<boolean> {
	if (hard) {
		const result = await db
			.deleteFrom("content_notes")
			.where("id", "=", rowId)
			.where("section_id", "=", node.id)
			.where("workspace_id", "=", node.workspace_id)
			.executeTakeFirst();
		return Number(result.numDeletedRows) > 0;
	}
	const result = await db
		.updateTable("content_notes")
		.set({ deleted: true, updated_at: new Date() })
		.where("id", "=", rowId)
		.where("section_id", "=", node.id)
		.where("workspace_id", "=", node.workspace_id)
		.executeTakeFirst();
	return Number(result.numUpdatedRows) > 0;
}

/** Plan §3.7: retag the core row, drop the source props row, no backfill. */
export async function moveRow(
	db: Kysely<ContentDB>,
	node: ContentNode,
	target: ContentNode,
	rowId: string,
): Promise<ContentRowDto | null> {
	if (target.type !== "section" || target.deleted) {
		throw new RowError(400, "Target must be a live section.");
	}
	const note = await db
		.updateTable("content_notes")
		.set({ section_id: target.id, updated_at: new Date() })
		.where("id", "=", rowId)
		.where("section_id", "=", node.id)
		.where("workspace_id", "=", node.workspace_id)
		.returningAll()
		.executeTakeFirst();
	if (!note) return null;
	if ((node.columns_config ?? []).length > 0) {
		await sql`
			delete from ${sql.id(CONTENT_SCHEMA, propsTableName(node.id))}
			where note_id = ${rowId}
		`.execute(db);
	}
	return serializeRow(note, undefined, target.columns_config ?? []);
}

export async function reorderRow(
	db: Kysely<ContentDB>,
	node: ContentNode,
	rowId: string,
	beforeRowId: string | null,
	afterRowId: string | null,
): Promise<number> {
	async function positionOf(id: string): Promise<number | null> {
		const row = await db
			.selectFrom("content_notes")
			.select("position")
			.where("id", "=", id)
			.where("section_id", "=", node.id)
			.executeTakeFirst();
		return row?.position ?? null;
	}
	const before = beforeRowId ? await positionOf(beforeRowId) : null;
	const after = afterRowId ? await positionOf(afterRowId) : null;
	if (beforeRowId && before === null)
		throw new RowError(404, "before_row not found.");
	if (afterRowId && after === null)
		throw new RowError(404, "after_row not found.");
	const position =
		before === null && after === null
			? POSITION_GAP
			: before === null
				? (after as number) / 2
				: after === null
					? before + POSITION_GAP
					: before + (after - before) / 2;
	await db
		.updateTable("content_notes")
		.set({ position, updated_at: new Date() })
		.where("id", "=", rowId)
		.where("section_id", "=", node.id)
		.where("workspace_id", "=", node.workspace_id)
		.execute();
	return position;
}
