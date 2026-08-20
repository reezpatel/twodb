import type { Kysely } from "kysely";
import type { AnyDb } from "../tree";
import type { ContentColumnConfig } from "@twodb/contracts";
import type { ContentDB } from "../../db/schema";
import { newColumnId, propsTableName, type ContentNode } from "../tree";
import { addPropsColumn, dropPropsColumn, retypePropsColumn } from "../tables";
import { COLUMN_REGISTRY, isColumnType } from "./registry";
import { jsonb } from "../serialize";

export class ColumnError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
	}
}

function sortedConfig(config: ContentColumnConfig[]): ContentColumnConfig[] {
	return [...config].sort((a, b) => a.position - b.position);
}

/**
 * Add a user column: physical ADD COLUMN + columns_config append, atomically
 * (callers run inside a transaction; the props DDL participates in it when
 * issued on the transaction handle — kysely schema builder works on trx).
 */
export async function addColumn(
	db: AnyDb,
	node: ContentNode,
	input: {
		name: string;
		type: string;
		options?: ContentColumnConfig["options"];
		relation?: ContentColumnConfig["relation"];
		position?: number;
	},
): Promise<ContentColumnConfig> {
	if (!input.name?.trim())
		throw new ColumnError(400, "Column name is required.");
	if (!isColumnType(input.type)) {
		throw new ColumnError(400, `Unknown column type "${input.type}".`);
	}
	if (input.type === "relation" && !input.relation?.section_id) {
		throw new ColumnError(400, "Relation columns need relation.section_id.");
	}
	const columnId = newColumnId();
	const config = sortedConfig(node.columns_config ?? []);
	const entry: ContentColumnConfig = {
		column_id: columnId,
		name: input.name.trim(),
		type: input.type,
		...(input.options ? { options: input.options } : {}),
		...(input.relation ? { relation: input.relation } : {}),
		position:
			input.position ??
			(config.length ? config[config.length - 1].position + 1024 : 0),
	};
	await addPropsColumn(db, propsTableName(node.id), columnId, input.type);
	await persistConfig(db, node.id, [...config, entry]);
	return entry;
}

export async function updateColumn(
	db: AnyDb,
	node: ContentNode,
	columnId: string,
	input: {
		name?: string;
		type?: string;
		options?: ContentColumnConfig["options"];
		relation?: ContentColumnConfig["relation"];
		position?: number;
	},
): Promise<ContentColumnConfig> {
	const config = sortedConfig(node.columns_config ?? []);
	const index = config.findIndex((c) => c.column_id === columnId);
	if (index === -1) throw new ColumnError(404, "No such column.");
	const current = config[index];

	if (input.type !== undefined && input.type !== current.type) {
		if (!isColumnType(input.type)) {
			throw new ColumnError(400, `Unknown column type "${input.type}".`);
		}
		const next: ContentColumnConfig = {
			...current,
			type: input.type,
			options: input.options ?? current.options,
		};
		await retypePropsColumn(
			db,
			propsTableName(node.id),
			columnId,
			input.type,
			next,
		);
		config[index] = next;
	}
	const merged: ContentColumnConfig = {
		...config[index],
		name: input.name?.trim() ?? config[index].name,
		options: input.options ?? config[index].options,
		relation: input.relation ?? config[index].relation,
		position: input.position ?? config[index].position,
	};
	config[index] = merged;
	await persistConfig(db, node.id, config);
	return merged;
}

export async function removeColumn(
	db: AnyDb,
	node: ContentNode,
	columnId: string,
): Promise<void> {
	const config = node.columns_config ?? [];
	if (!config.some((c) => c.column_id === columnId)) {
		throw new ColumnError(404, "No such column.");
	}
	await dropPropsColumn(db, propsTableName(node.id), columnId);
	await persistConfig(
		db,
		node.id,
		config.filter((c) => c.column_id !== columnId),
	);
	// Strip the column from every saved view config of this section.
	const views = await db
		.selectFrom("content_views")
		.select(["id", "config"])
		.where("section_id", "=", node.id)
		.execute();
	for (const view of views) {
		const cfg = view.config;
		const next = {
			...cfg,
			filters: (cfg.filters ?? []).filter((f) => f.column_id !== columnId),
			sorts: (cfg.sorts ?? []).filter((s) => s.column_id !== columnId),
			hidden_columns: (cfg.hidden_columns ?? []).filter((c) => c !== columnId),
			group_by: cfg.group_by === columnId ? null : (cfg.group_by ?? null),
		};
		await db
			.updateTable("content_views")
			.set({ config: next })
			.where("id", "=", view.id)
			.execute();
	}
}

async function persistConfig(
	db: AnyDb,
	nodeId: string,
	config: ContentColumnConfig[],
): Promise<void> {
	await db
		.updateTable("content_nodes")
		.set({ columns_config: jsonb(config), updated_at: new Date() })
		.where("id", "=", nodeId)
		.execute();
}
