import { useMemo } from "react";
import type {
	ContentColumnType,
	ContentRowDto,
	ContentSchemaColumn,
} from "@twodb/contracts";
import { Badge, IconButton } from "@twodb/ui";
import type { BadgeTone, CellType, DataColumn, FilterSpec } from "@twodb/ui";
import { Trash2 } from "lucide-react";
import { useSection } from "../../provider/section-provider";
import { useSectionRows } from "../../hooks/use-section-rows.hook";

const CELL_TYPES: Partial<Record<ContentColumnType, CellType>> = {
	text: "text",
	number: "number",
	url: "url",
	select: "select",
	multi_select: "multiselect",
};

const CHECKBOX_OPTIONS = [
	{ value: "true", label: "Yes", tone: "go" as BadgeTone },
	{ value: "false", label: "No", tone: "neutral" as BadgeTone },
];

function cellValue(row: ContentRowDto, column: ContentSchemaColumn): unknown {
	if (!column.mandatory) return row.values[column.column_id];
	switch (column.column_id) {
		case "title":
			return row.title;
		case "content":
			return row.preview;
		case "completed":
			return row.completed;
		case "tags":
			return row.tags.map((t) => t.label);
		case "created_at":
			return row.created_at;
		case "updated_at":
			return row.updated_at;
		default:
			return undefined;
	}
}

function setCellValue(
	row: ContentRowDto,
	column: ContentSchemaColumn,
	v: unknown,
): ContentRowDto {
	if (!column.mandatory) {
		return { ...row, values: { ...row.values, [column.column_id]: v } };
	}
	switch (column.column_id) {
		case "title":
			return { ...row, title: String(v ?? "") };
		case "content":
			return { ...row, preview: String(v ?? "") };
		case "completed":
			return { ...row, completed: v === true || v === "true" };
		case "tags":
			return {
				...row,
				tags: (Array.isArray(v) ? v : []).map((label) => ({
					label: String(label),
				})),
			};
		default:
			return row;
	}
}

function formatDate(value: unknown): string {
	if (typeof value !== "string" || !value) return "";
	const time = Date.parse(value);
	if (Number.isNaN(time)) return String(value);
	return new Date(time).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function toText(value: unknown): string {
	if (Array.isArray(value)) return value.join(", ");
	if (typeof value === "number") return String(value);
	return String(value ?? "");
}

function toDataColumn(
	column: ContentSchemaColumn,
	tagOptions: { value: string; label: string; tone: BadgeTone }[],
): DataColumn<ContentRowDto> {
	const value = (row: ContentRowDto) => cellValue(row, column);
	const base = {
		id: column.column_id,
		label: column.name,
		width: column.width,
	};

	if (column.type === "checkbox") {
		return {
			...base,
			type: "select",
			options: CHECKBOX_OPTIONS,
			cell: (row) => {
				const v = value(row);
				return v == null ? (
					<span className="tw-cell-empty">—</span>
				) : (
					<Badge size="sm" tone={v ? "go" : "neutral"}>
						{v ? "Yes" : "No"}
					</Badge>
				);
			},
			editValue: (row) => String(!!value(row)),
			setValue: (row, v) =>
				setCellValue(row, column, v === true || v === "true"),
			sortValue: (row) => (value(row) ? 1 : 0),
			filter: { kind: "enum", options: CHECKBOX_OPTIONS },
			filterValue: (row) => String(!!value(row)),
		};
	}

	if (column.type === "date") {
		const editable = !column.mandatory;
		return {
			...base,
			type: "text",
			cell: (row) => formatDate(value(row)) || "—",
			...(editable
				? {
						editValue: (row: ContentRowDto) => {
							const v = value(row);
							return typeof v === "string" ? v.slice(0, 10) : "";
						},
						setValue: (row: ContentRowDto, v: unknown) =>
							setCellValue(row, column, String(v ?? "").trim() || null),
					}
				: {}),
			sortValue: (row) => Date.parse(String(value(row) ?? "")) || 0,
			filter: { kind: "text" },
			filterValue: (row) => formatDate(value(row)),
		};
	}

	if (column.type === "select" || column.type === "multi_select") {
		const isMulti = column.type === "multi_select";
		const isCoreTags = column.mandatory && column.column_id === "tags";
		const options = isCoreTags
			? tagOptions
			: column.options?.choices?.map((c) => ({
					value: c.value,
					label: c.label,
					tone: (c.tone as BadgeTone | undefined) ?? "neutral",
				}));
		return {
			...base,
			type: isMulti ? (isCoreTags ? "chips" : "multiselect") : "select",
			options,
			editValue: (row) => {
				const v = value(row);
				return isMulti ? (Array.isArray(v) ? v : []) : v;
			},
			setValue: (row, v) => setCellValue(row, column, v),
			sortValue: (row) => toText(value(row)),
			filter: isMulti
				? ({ kind: "text" } as FilterSpec)
				: ({ kind: "enum", options: options ?? [] } as FilterSpec),
			filterValue: (row) => toText(value(row)),
		};
	}

	if (column.type === "number") {
		return {
			...base,
			type: "number",
			align: "right",
			editValue: value,
			setValue: (row, v) => {
				const s = String(v ?? "").trim();
				return setCellValue(row, column, s === "" ? null : Number(v));
			},
			sortValue: (row) => {
				const v = value(row);
				return typeof v === "number" ? v : Number.NEGATIVE_INFINITY;
			},
			filter: { kind: "number" },
			filterValue: (row) => {
				const v = value(row);
				return typeof v === "number" ? v : Number.NaN;
			},
		};
	}

	// text / url / relation / person
	return {
		...base,
		type: CELL_TYPES[column.type] ?? "text",
		editValue: value,
		setValue: (row, v) => {
			const s = String(v ?? "");
			return setCellValue(row, column, s === "" ? null : s);
		},
		sortValue: (row) => toText(value(row)),
		filter: { kind: "text" },
		filterValue: (row) => toText(value(row)),
	};
}

export function useTableColumns(
	onDeleteRow: (rowId: string) => void,
): DataColumn<ContentRowDto>[] {
	const { columns, activeViewConfig } = useSection();
	const { data } = useSectionRows();
	const hidden = activeViewConfig.hidden_columns;

	const tagOptions = useMemo(() => {
		const seen = new Map<
			string,
			{ value: string; label: string; tone: BadgeTone }
		>();
		for (const row of data?.rows ?? []) {
			for (const tag of row.tags) {
				if (!seen.has(tag.label)) {
					seen.set(tag.label, {
						value: tag.label,
						label: tag.label,
						tone: (tag.tone as BadgeTone | undefined) ?? "neutral",
					});
				}
			}
		}
		return [...seen.values()];
	}, [data]);

	return useMemo(
		() => [
			...columns
				.filter((c) => !hidden?.includes(c.column_id))
				.map((c) => toDataColumn(c, tagOptions)),
			{
				id: "__actions",
				label: "",
				width: 52,
				cell: (row: ContentRowDto) => (
					<IconButton
						size="sm"
						label="Delete note"
						icon={<Trash2 size={13} />}
						onClick={() => onDeleteRow(row.id)}
					/>
				),
			},
		],
		[columns, hidden, onDeleteRow, tagOptions],
	);
}
