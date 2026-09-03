import { useQuery } from "@tanstack/react-query";
import { PLUGIN_ID } from "../../shared/constants";
import { rowsApi } from "../api";
import { useSection } from "../provider/section-provider";

export function useSectionRows() {
	const { section, activeViewConfig } = useSection();

	return useQuery({
		queryKey: [PLUGIN_ID, "rows", section?.id, activeViewConfig.search],
		enabled: !!section?.id,
		queryFn: () =>
			rowsApi.list(section?.id ?? "", {
				limit: 10000,
				search: activeViewConfig.search,
			}),
	});
}
