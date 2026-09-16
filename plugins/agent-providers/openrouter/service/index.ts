import { rootServicePlugin } from "@twodb/shared-backend";
import { openrouterManifest } from "../shared/manifest";

export const TwodbOpenRouterServiceManifest = {
	...openrouterManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-openrouter-service",
		async () => {},
	),
};

export const service = TwodbOpenRouterServiceManifest;

export default TwodbOpenRouterServiceManifest;
