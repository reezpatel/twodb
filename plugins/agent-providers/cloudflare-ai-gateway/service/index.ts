import { rootServicePlugin } from "@twodb/shared-backend";
import { cloudflareAiGatewayManifest } from "../shared/manifest";

export const TwodbCloudflareAIGatewayServiceManifest = {
	...cloudflareAiGatewayManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-cloudflare-ai-gateway-service",
		async () => {},
	),
};

export const service = TwodbCloudflareAIGatewayServiceManifest;

export default TwodbCloudflareAIGatewayServiceManifest;
