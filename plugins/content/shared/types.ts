/**
 * Request body types for the content plugin API — shared between the
 * service (route handlers cast their request.body into these) and the view
 * (the `view/api/` client functions send these). Response shapes live in
 * `@twodb/contracts`; this file covers the inputs.
 */
import type {
	ContentAttachment,
	ContentColumnType,
	ContentFilter,
	ContentLink,
	ContentNodeType,
	ContentSort,
	ContentTag,
	ContentViewConfig,
	ContentViewType,
} from "@twodb/contracts";

// -- tree / nodes ------------------------------------------------------------

export interface PostNodeBody {
	parent_id?: string | null;
	type: ContentNodeType;
	name: string;
	position?: number;
}

export interface PatchNodeBody {
	name?: string;
	identifier?: string;
	show_in_overview?: boolean;
	default_view?: string | null;
}

export interface MoveNodeBody {
	parent_id?: string | null;
	position?: number;
}

// -- sections / columns ------------------------------------------------------

export interface AddColumnBody {
	name: string;
	type: ContentColumnType;
	options?: { choices?: unknown[] };
	relation?: { section_id: string };
	position?: number;
}

export interface PatchColumnBody {
	name?: string;
	type?: ContentColumnType;
	options?: { choices?: unknown[] };
	relation?: { section_id: string };
	position?: number;
}

// -- rows --------------------------------------------------------------------

export interface ListRowsQuery {
	filters?: ContentFilter[];
	sorts?: ContentSort[];
	search?: string;
	limit?: number;
	cursor?: string;
	/** Include soft-deleted rows in the result. */
	deleted?: boolean;
}

/**
 * Body accepted by both POST /sections/:id/rows and
 * PATCH /sections/:id/rows/:rowId. Server-side coercion against the
 * section's column schema is documented in service/lib/rows.ts.
 */
export interface RowMutationBody {
	title?: string;
	content?: string;
	completed?: boolean;
	/** PATCH-only flag; create rows are inserted live. */
	deleted?: boolean;
	position?: number;
	tags?: ContentTag[];
	links?: ContentLink[];
	attachments?: ContentAttachment[];
	/** User-column cells, keyed by column_id. */
	values?: Record<string, unknown>;
}

export type CreateRowBody = RowMutationBody;
export type UpdateRowBody = RowMutationBody;

export interface MoveRowBody {
	target_section_id: string;
}

export interface ReorderRowsBody {
	row_id: string;
	before_row_id?: string | null;
	after_row_id?: string | null;
}

// -- views -------------------------------------------------------------------

export interface CreateViewBody {
	name: string;
	type: ContentViewType;
	config?: ContentViewConfig;
	is_default?: boolean;
}

export interface PatchViewBody {
	name?: string;
	config?: ContentViewConfig;
	position?: number;
}
