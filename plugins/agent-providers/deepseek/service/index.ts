import { rootServicePlugin } from "@twodb/shared-backend";
import { deepseekManifest } from "../shared/manifest";

export const TwodbDeepSeekServiceManifest = {
	...deepseekManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-deepseek-service",
		async () => {},
	),
};

export const service = TwodbDeepSeekServiceManifest;

export default TwodbDeepSeekServiceManifest;
