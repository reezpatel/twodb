import { rootServicePlugin } from "@twodb/shared-backend";
import { zaiManifest } from "../shared/manifest";

export const TwodbZaiServiceManifest = {
	...zaiManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-zai-service",
		async () => {},
	),
};

export const service = TwodbZaiServiceManifest;

export default TwodbZaiServiceManifest;
