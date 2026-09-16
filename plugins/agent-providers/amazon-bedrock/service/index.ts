import { rootServicePlugin } from "@twodb/shared-backend";
import { amazonBedrockManifest } from "../shared/manifest";

export const TwodbAmazonBedrockServiceManifest = {
	...amazonBedrockManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-amazon-bedrock-service",
		async () => {},
	),
};

export const service = TwodbAmazonBedrockServiceManifest;

export default TwodbAmazonBedrockServiceManifest;
