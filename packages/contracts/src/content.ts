/**
 * Content plugin contracts — DTOs shared by the service (responses) and the
 * view (rendering). Mirrors plugins/content/plan.md §3–§5.
 */

export type ContentNodeType = "folder" | "section";
export type ContentViewType = "list" | "table" | "kanban" | "project";

export type ContentColumnType =
	| "text"
	| "number"
	| "checkbox"
	| "date"
	| "url"
	| "select"
	| "multi_select"
	| "relation"
	| "person";

export interface ContentColumnChoice {
	value: string;
	label: string;
	tone?: string;
}

/** Entry of a section's columns_config jsonb (physical column in the props table). */
export interface ContentColumnConfig {
	column_id: string;
	name: string;
	type: ContentColumnType;
	options?: { choices?: ContentColumnChoice[] };
	relation?: { section_id: string };
	width?: number;
	position: number;
}

/** Schema DTO column: a user column or a mandatory core field. */
export interface ContentSchemaColumn extends ContentColumnConfig {
	mandatory: boolean;
}

export interface ContentNodeDto {
	id: string;
	workspace_id: string;
	parent_id: string | null;
	type: ContentNodeType;
	name: string;
	identifier: string;
	position: number;
	deleted: boolean;
	show_in_overview: boolean;
	columns_config: ContentColumnConfig[];
	default_view: string | null;
	created_by: string;
	created_at: string;
	updated_at: string;
}

export interface ContentFilter {
	column_id: string;
	op:
		| "is"
		| "is_not"
		| "contains"
		| "not_contains"
		| "gt"
		| "lt"
		| "gte"
		| "lte"
		| "is_empty"
		| "is_not_empty";
	value?: unknown;
}

export interface ContentSort {
	column_id: string;
	dir: "asc" | "desc";
}

export interface ContentViewConfig {
	filters?: ContentFilter[];
	sorts?: ContentSort[];
	group_by?: string | null;
	hidden_columns?: string[];
	search?: string;
	type: ContentViewType;
}

export interface ContentViewDto {
	id: string;
	section_id: string;
	workspace_id: string;
	name: string;
	config: ContentViewConfig;
	is_default: boolean;
	position: number;
	deleted: boolean;
	created_at: string;
	updated_at: string;
}

export interface ContentTag {
	label: string;
	tone?: string;
	link?: boolean;
}

export interface ContentLink {
	kind: "note" | "node" | "url";
	target: string;
	label: string;
}

export interface ContentAttachment {
	name: string;
	url: string;
	size?: number;
	mime?: string;
}

export interface ContentRowDto {
	id: string;
	section_id: string;
	workspace_id: string;
	title: string;
	/** Plain-text excerpt of the row document (content is fetched separately). */
	preview: string;
	completed: boolean;
	deleted: boolean;
	position: number;
	tags: ContentTag[];
	links: ContentLink[];
	attachments: ContentAttachment[];
	created_by: string;
	created_at: string;
	updated_at: string;
	/** User-column cells from the section's props table, keyed by column_id. */
	values: Record<string, unknown>;
}

export interface ContentSectionSchemaDto {
	section: ContentNodeDto;
	columns: ContentSchemaColumn[];
}

/** Response of GET /sections/:id/rows/:rowId/content — the full document. */
export interface ContentRowContentDto {
	id: string;
	content: unknown;
}
