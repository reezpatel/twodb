import { rootServicePlugin } from "@twodb/shared-backend";
import { googleManifest } from "../shared/manifest";

export const TwodbGoogleGeminiServiceManifest = {
	...googleManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-google-service",
		async () => {},
	),
};

export const service = TwodbGoogleGeminiServiceManifest;

export default TwodbGoogleGeminiServiceManifest;
