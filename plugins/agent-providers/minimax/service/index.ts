import { rootServicePlugin } from "@twodb/shared-backend";
import { minimaxManifest } from "../shared/manifest";

export const TwodbMiniMaxServiceManifest = {
	...minimaxManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-minimax-service",
		async () => {},
	),
};

export const service = TwodbMiniMaxServiceManifest;

export default TwodbMiniMaxServiceManifest;
