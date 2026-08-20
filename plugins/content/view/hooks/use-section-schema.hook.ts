import { useQuery } from "@tanstack/react-query";
import type { ContentSectionSchemaDto, ContentViewDto } from "@twodb/contracts";
import { apiClient, CONTENT_QK, contentQueryRetry } from "../utils";

export function useSectionSchema(identifier: string | undefined) {
	return useQuery({
		queryKey: [CONTENT_QK, "schema", identifier],
		...contentQueryRetry,
		enabled: Boolean(identifier),
		queryFn: () =>
			apiClient.get<ContentSectionSchemaDto>(`/sections/${identifier}/schema`),
	});
}

export function useSectionViews(identifier: string | undefined) {
	return useQuery({
		queryKey: [CONTENT_QK, "views", identifier],
		...contentQueryRetry,
		enabled: Boolean(identifier),
		queryFn: () =>
			apiClient.get<{ views: ContentViewDto[] }>(
				`/sections/${identifier}/views`,
			),
		select: (data) => data.views,
	});
}
