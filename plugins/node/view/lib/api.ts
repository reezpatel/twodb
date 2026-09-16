import { ApiClient } from "@twodb/shared-frontend";
import { PLUGIN_ID } from "../../shared/constants";

export const nodeApi = new ApiClient(PLUGIN_ID);

export const nodesQueryKey = [PLUGIN_ID, "nodes"] as const;

export const nodeDetailQueryKey = (id: string) =>
	[PLUGIN_ID, "node", id] as const;
