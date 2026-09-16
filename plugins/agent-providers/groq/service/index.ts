import { rootServicePlugin } from "@twodb/shared-backend";
import { groqManifest } from "../shared/manifest";

export const TwodbGroqServiceManifest = {
	...groqManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-groq-service",
		async () => {},
	),
};

export const service = TwodbGroqServiceManifest;

export default TwodbGroqServiceManifest;
