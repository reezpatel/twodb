import { ApiClient } from "@twodb/shared-frontend";
import { PLUGIN_ID } from "../../shared/constants";

export const agentApi = new ApiClient(PLUGIN_ID);

export const agentsQueryKey = [PLUGIN_ID, "agents"] as const;
export const usageSummaryQueryKey = [
	PLUGIN_ID,
	"agents-usage-summary",
] as const;
