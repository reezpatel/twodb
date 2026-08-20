/**
 * View API — mirrors plugins/content/service/routes/views.
 */
import type { ContentViewDto } from "@twodb/contracts";
import type { CreateViewBody, PatchViewBody } from "../../shared/types";
import { apiClient } from "../utils";

export const viewsApi = {
	list: (sectionId: string) =>
		apiClient.get<{ views: ContentViewDto[] }>(`/sections/${sectionId}/views`),

	create: (sectionId: string, body: CreateViewBody) =>
		apiClient.post<{ view: ContentViewDto }>(
			`/sections/${sectionId}/views`,
			body,
		),

	update: (sectionId: string, viewId: string, body: PatchViewBody) =>
		apiClient.patch<{ view: ContentViewDto }>(
			`/sections/${sectionId}/views/${viewId}`,
			body,
		),

	setDefault: (sectionId: string, viewId: string) =>
		apiClient.post<{ view: ContentViewDto }>(
			`/sections/${sectionId}/views/${viewId}/default`,
		),

	remove: (sectionId: string, viewId: string) =>
		apiClient.del(`/sections/${sectionId}/views/${viewId}`),
};
