import { rootServicePlugin } from "@twodb/shared-backend";
import { openaiManifest } from "../shared/manifest";

export const TwodbOpenAIServiceManifest = {
	...openaiManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-openai-service",
		async () => {},
	),
};

export const service = TwodbOpenAIServiceManifest;

export default TwodbOpenAIServiceManifest;
