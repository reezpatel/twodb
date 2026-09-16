import { rootServicePlugin } from "@twodb/shared-backend";
import { azureOpenaiManifest } from "../shared/manifest";

export const TwodbAzureOpenAIServiceManifest = {
	...azureOpenaiManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-azure-openai-service",
		async () => {},
	),
};

export const service = TwodbAzureOpenAIServiceManifest;

export default TwodbAzureOpenAIServiceManifest;
