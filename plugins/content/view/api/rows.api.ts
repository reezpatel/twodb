/**
 * Row API — mirrors plugins/content/service/routes/rows. Filters, sorts and
 * cursors are passed as URLSearchParams per the service contract.
 */
import type { ContentRowContentDto, ContentRowDto } from "@twodb/contracts";
import type {
	CreateRowBody,
	ListRowsQuery,
	MoveRowBody,
	ReorderRowsBody,
	UpdateRowBody,
} from "../../shared/types";
import { apiClient } from "../utils";

export interface DeleteRowOptions {
	/** When true, the row is hard-deleted; otherwise it is soft-deleted. */
	hard?: boolean;
}

export const rowsApi = {
	list: (sectionId: string, query: ListRowsQuery = {}) => {
		const params = new URLSearchParams();
		if (query.filters) params.set("filters", JSON.stringify(query.filters));
		if (query.sorts) params.set("sorts", JSON.stringify(query.sorts));
		if (query.search) params.set("search", query.search);
		if (query.limit !== undefined) params.set("limit", String(query.limit));
		if (query.cursor) params.set("cursor", query.cursor);
		if (query.deleted) params.set("deleted", "true");
		const qs = params.toString();
		return apiClient.get<{
			rows: ContentRowDto[];
			next_cursor: string | null;
		}>(`/sections/${sectionId}/rows${qs ? `?${qs}` : ""}`);
	},

	create: (sectionId: string, body: CreateRowBody) =>
		apiClient.post<{ row: ContentRowDto }>(`/sections/${sectionId}/rows`, body),

	get: (sectionId: string, rowId: string) =>
		apiClient.get<{ row: ContentRowDto }>(
			`/sections/${sectionId}/rows/${rowId}`,
		),

	/** Full JSON document — separate endpoint, not part of ContentRowDto. */
	getContent: (sectionId: string, rowId: string) =>
		apiClient.get<ContentRowContentDto>(
			`/sections/${sectionId}/rows/${rowId}/content`,
		),

	update: (sectionId: string, rowId: string, body: UpdateRowBody) =>
		apiClient.patch<{ row: ContentRowDto }>(
			`/sections/${sectionId}/rows/${rowId}`,
			body,
		),

	remove: (sectionId: string, rowId: string, opts: DeleteRowOptions = {}) =>
		apiClient.del(
			`/sections/${sectionId}/rows/${rowId}${opts.hard ? "?hard=true" : ""}`,
		),

	move: (sectionId: string, rowId: string, body: MoveRowBody) =>
		apiClient.post<{ row: ContentRowDto }>(
			`/sections/${sectionId}/rows/${rowId}/move`,
			body,
		),

	reorder: (sectionId: string, body: ReorderRowsBody) =>
		apiClient.post<{ row_id: string; position: number }>(
			`/sections/${sectionId}/rows/reorder`,
			body,
		),
};
