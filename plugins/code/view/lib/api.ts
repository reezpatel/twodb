import { ApiClient } from "@twodb/shared-frontend";
import { PLUGIN_ID } from "../../shared/constants";

export const codeApi = new ApiClient(PLUGIN_ID);

export const sessionNodesQueryKey = [PLUGIN_ID, "nodes"] as const;

export const folderSearchQueryKey = (nodeId: string, query: string) =>
	[PLUGIN_ID, "folders", nodeId, query] as const;

export const sessionsQueryKey = [PLUGIN_ID, "sessions"] as const;

export const sessionAgentsQueryKey = [PLUGIN_ID, "agents"] as const;

export const archivedSessionsQueryKey = [
	PLUGIN_ID,
	"sessions",
	"archived",
] as const;
