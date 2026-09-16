import { rootServicePlugin } from "@twodb/shared-backend";
import { ollamaCloudManifest } from "../shared/manifest";

export const TwodbOllamaCloudServiceManifest = {
	...ollamaCloudManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-ollama-cloud-service",
		async () => {},
	),
};

export const service = TwodbOllamaCloudServiceManifest;

export default TwodbOllamaCloudServiceManifest;
