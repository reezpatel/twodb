import { sql, type RawBuilder } from "kysely";
import type { ContentColumnConfig, ContentColumnType } from "@twodb/contracts";

/**
 * Column type registry (plan §4): the single source of truth for each type's
 * postgres type, its safe-cast expression (best-effort, null on failure),
 * and value validation/coercion for row writes.
 */

interface RegistryEntry {
	pgType: "text" | "float8" | "boolean" | "timestamptz" | "jsonb";
	/** ALTER TABLE … USING expression for changing a column TO this type. */
	castSql: (
		column: string,
		config?: ContentColumnConfig,
	) => RawBuilder<unknown>;
	/** Validate + coerce a client value; returns the pg-ready value. */
	coerce: (
		value: unknown,
		config?: ContentColumnConfig,
	) => { ok: true; value: unknown } | { ok: false };
}

const ID_PATTERN = /^[a-z]{3}-[A-Za-z0-9]+$/;

function coerceString(
	value: unknown,
): { ok: true; value: unknown } | { ok: false } {
	if (value === null) return { ok: true, value: null };
	if (typeof value === "string") return { ok: true, value };
	return { ok: false };
}

function coerceId(
	value: unknown,
): { ok: true; value: unknown } | { ok: false } {
	if (value === null) return { ok: true, value: null };
	if (typeof value === "string" && ID_PATTERN.test(value))
		return { ok: true, value };
	return { ok: false };
}

function choiceValues(config?: ContentColumnConfig): Set<string> {
	return new Set(config?.options?.choices?.map((c) => c.value) ?? []);
}

export const COLUMN_REGISTRY: Record<ContentColumnType, RegistryEntry> = {
	text: {
		pgType: "text",
		castSql: (col) => sql`${sql.ref(col)}::text`,
		coerce: coerceString,
	},
	number: {
		pgType: "float8",
		castSql: (col) => sql`
			case when nullif(btrim(${sql.ref(col)}::text), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
				then ${sql.ref(col)}::text::float8 end
		`,
		coerce: (value) => {
			if (value === null) return { ok: true, value: null };
			const n = typeof value === "number" ? value : Number(value);
			if (typeof value === "string" && value.trim() === "")
				return { ok: false };
			return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
		},
	},
	checkbox: {
		pgType: "boolean",
		castSql: (col) => sql`
			case
				when lower(${sql.ref(col)}::text) in ('true', '1', 'yes', 'on') then true
				when lower(${sql.ref(col)}::text) in ('false', '0', 'no', 'off') then false
			end
		`,
		coerce: (value) => {
			if (value === null) return { ok: true, value: null };
			if (typeof value === "boolean") return { ok: true, value };
			return { ok: false };
		},
	},
	date: {
		pgType: "timestamptz",
		castSql: (col) => sql`
			case when ${sql.ref(col)}::text ~ '^\d{4}-\d{2}-\d{2}'
				then ${sql.ref(col)}::text::timestamptz end
		`,
		coerce: (value) => {
			if (value === null) return { ok: true, value: null };
			if (typeof value !== "string") return { ok: false };
			const time = Date.parse(value);
			return Number.isNaN(time)
				? { ok: false }
				: { ok: true, value: new Date(time).toISOString() };
		},
	},
	url: {
		pgType: "text",
		castSql: (col) => sql`${sql.ref(col)}::text`,
		coerce: coerceString,
	},
	select: {
		pgType: "text",
		castSql: (col, config) => {
			const choices = [...choiceValues(config)];
			if (choices.length === 0) return sql`null`;
			return sql`
				case when ${sql.ref(col)}::text = any (${sql.val(choices)}::text[])
					then ${sql.ref(col)}::text end
			`;
		},
		coerce: (value, config) => {
			if (value === null) return { ok: true, value: null };
			if (typeof value !== "string") return { ok: false };
			const choices = choiceValues(config);
			return choices.size === 0 || choices.has(value)
				? { ok: true, value }
				: { ok: false };
		},
	},
	multi_select: {
		pgType: "jsonb",
		castSql: (col) => sql`
			case when ${sql.ref(col)} is not null then to_jsonb(
				string_to_array(${sql.ref(col)}::text, ',')
			) end
		`,
		coerce: (value, config) => {
			if (value === null) return { ok: true, value: null };
			if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
				return { ok: false };
			}
			const choices = choiceValues(config);
			if (choices.size > 0 && value.some((v) => !choices.has(v))) {
				return { ok: false };
			}
			return { ok: true, value: JSON.stringify(value) };
		},
	},
	relation: {
		pgType: "text",
		castSql: (col) => sql`
			case when ${sql.ref(col)}::text ~ '^[a-z]{3}-[A-Za-z0-9]+$'
				then ${sql.ref(col)}::text end
		`,
		coerce: coerceId,
	},
	person: {
		pgType: "text",
		castSql: (col) => sql`
			case when ${sql.ref(col)}::text ~ '^[a-z]{3}-[A-Za-z0-9]+$'
				then ${sql.ref(col)}::text end
		`,
		coerce: coerceId,
	},
};

export function isColumnType(value: string): value is ContentColumnType {
	return value in COLUMN_REGISTRY;
}
