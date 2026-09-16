import { rootServicePlugin } from "@twodb/shared-backend";
import { cerebrasManifest } from "../shared/manifest";

export const TwodbCerebrasServiceManifest = {
	...cerebrasManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-cerebras-service",
		async () => {},
	),
};

export const service = TwodbCerebrasServiceManifest;

export default TwodbCerebrasServiceManifest;
