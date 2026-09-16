import { rootServicePlugin } from "@twodb/shared-backend";
import { customOpenaiManifest } from "../shared/manifest";

export const TwodbCustomOpenAIServiceManifest = {
	...customOpenaiManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-custom-openai-service",
		async () => {},
	),
};

export const service = TwodbCustomOpenAIServiceManifest;

export default TwodbCustomOpenAIServiceManifest;
