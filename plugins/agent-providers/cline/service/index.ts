import { rootServicePlugin } from "@twodb/shared-backend";
import { clineManifest } from "../shared/manifest";

export const TwodbClineServiceManifest = {
	...clineManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-cline-service",
		async () => {},
	),
};

export const service = TwodbClineServiceManifest;

export default TwodbClineServiceManifest;
