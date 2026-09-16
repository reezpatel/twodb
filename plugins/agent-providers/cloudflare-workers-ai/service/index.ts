import { rootServicePlugin } from "@twodb/shared-backend";
import { cloudflareWorkersAiManifest } from "../shared/manifest";

export const TwodbCloudflareWorkersAIServiceManifest = {
	...cloudflareWorkersAiManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-cloudflare-workers-ai-service",
		async () => {},
	),
};

export const service = TwodbCloudflareWorkersAIServiceManifest;

export default TwodbCloudflareWorkersAIServiceManifest;
