import { useQuery } from "@tanstack/react-query";
import type { ContentRowDto } from "@twodb/contracts";
import { apiClient, CONTENT_QK, contentQueryRetry } from "../utils";

export interface RowsQueryInput {
	search?: string;
}

export function useRows(
	identifier: string | undefined,
	input: RowsQueryInput = {},
) {
	return useQuery({
		queryKey: [CONTENT_QK, "rows", identifier, input],
		...contentQueryRetry,
		enabled: Boolean(identifier),
		queryFn: () => {
			const params = new URLSearchParams();
			if (input.search) params.set("search", input.search);
			const qs = params.toString();
			return apiClient.get<{
				rows: ContentRowDto[];
				next_cursor: string | null;
			}>(`/sections/${identifier}/rows${qs ? `?${qs}` : ""}`);
		},
		select: (data) => data.rows,
	});
}
