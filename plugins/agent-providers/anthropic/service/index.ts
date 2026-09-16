import { rootServicePlugin } from "@twodb/shared-backend";
import { anthropicManifest } from "../shared/manifest";

export const TwodbAnthropicServiceManifest = {
	...anthropicManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-anthropic-service",
		async () => {},
	),
};

export const service = TwodbAnthropicServiceManifest;

export default TwodbAnthropicServiceManifest;
