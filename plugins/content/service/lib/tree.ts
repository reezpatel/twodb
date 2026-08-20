import { randomBytes } from "node:crypto";
import type { Kysely, Transaction } from "kysely";
import type { ContentDB, ContentNodesTable } from "../db/schema";
import type { Selectable } from "kysely";

/** Any query handle: the scoped db or a transaction on it. */
export type AnyDb = Kysely<ContentDB> | Transaction<ContentDB>;

export type ContentNode = Selectable<ContentNodesTable>;

/** Physical props-table name for a section node (plan §3.4). */
export function propsTableName(nodeId: string): string {
	const body = nodeId.replace(/^nod-/, "").toLowerCase();
	return `sec_${body}_props`;
}

/** Random physical column name: `col_` + 10 lowercase alnum chars. */
export function newColumnId(): string {
	const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
	const bytes = randomBytes(10);
	let out = "";
	for (const byte of bytes) out += alphabet[byte % alphabet.length];
	return `col_${out}`;
}

export function slugify(name: string): string {
	const slug = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "section";
}

/** Unique section identifier within the workspace: base, base-2, base-3… */
export async function uniqueIdentifier(
	db: AnyDb,
	workspaceId: string,
	name: string,
): Promise<string> {
	const base = slugify(name);
	const existing = await db
		.selectFrom("content_nodes")
		.select("identifier")
		.where("workspace_id", "=", workspaceId)
		.where("type", "=", "section")
		.where("deleted", "=", false)
		.execute();
	const taken = new Set(existing.map((r) => r.identifier.toLowerCase()));
	if (!taken.has(base)) return base;
	for (let i = 2; ; i += 1) {
		const candidate = `${base}-${i}`;
		if (!taken.has(candidate)) return candidate;
	}
}

const POSITION_GAP = 1024;

/** Position for a new child appended at the end of its parent. */
export async function nextPosition(
	db: AnyDb,
	workspaceId: string,
	parentId: string | null,
): Promise<number> {
	const row = await db
		.selectFrom("content_nodes")
		.select("position")
		.where("workspace_id", "=", workspaceId)
		.where("parent_id", parentId === null ? "is" : "=", parentId)
		.orderBy("position", "desc")
		.limit(1)
		.executeTakeFirst();
	return (row?.position ?? 0) + POSITION_GAP;
}

/** Midpoint insertion between two neighbours (either may be absent). */
export function positionBetween(
	before: number | null,
	after: number | null,
): number {
	if (before === null && after === null) return POSITION_GAP;
	if (before === null) return (after as number) / 2;
	if (after === null) return before + POSITION_GAP;
	return before + (after - before) / 2;
}

/** True when `ancestorId` is `nodeId` itself or one of its ancestors. */
export async function isSelfOrAncestor(
	db: AnyDb,
	nodeId: string,
	ancestorId: string,
): Promise<boolean> {
	let cursor: string | null = nodeId;
	const seen = new Set<string>();
	while (cursor) {
		if (cursor === ancestorId) return true;
		if (seen.has(cursor)) return false;
		seen.add(cursor);
		const row = await db
			.selectFrom("content_nodes")
			.select("parent_id")
			.where("id", "=", cursor)
			.executeTakeFirst();
		cursor = row?.parent_id ?? null;
	}
	return false;
}
