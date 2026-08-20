/**
 * Section schema + column API — mirrors
 * plugins/content/service/routes/sections.
 */
import type {
	ContentSchemaColumn,
	ContentSectionSchemaDto,
} from "@twodb/contracts";
import type { AddColumnBody, PatchColumnBody } from "../../shared/types";
import { apiClient } from "../utils";

export const schemaApi = {
	get: (sectionId: string) =>
		apiClient.get<ContentSectionSchemaDto>(`/sections/${sectionId}/schema`),
};

export const columnsApi = {
	add: (sectionId: string, body: AddColumnBody) =>
		apiClient.post<{ column: ContentSchemaColumn }>(
			`/sections/${sectionId}/columns`,
			body,
		),

	update: (sectionId: string, columnId: string, body: PatchColumnBody) =>
		apiClient.patch<{ column: ContentSchemaColumn }>(
			`/sections/${sectionId}/columns/${columnId}`,
			body,
		),

	remove: (sectionId: string, columnId: string) =>
		apiClient.del(`/sections/${sectionId}/columns/${columnId}`),
};
