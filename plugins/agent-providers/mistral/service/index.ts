import { rootServicePlugin } from "@twodb/shared-backend";
import { mistralManifest } from "../shared/manifest";

export const TwodbMistralServiceManifest = {
	...mistralManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-mistral-service",
		async () => {},
	),
};

export const service = TwodbMistralServiceManifest;

export default TwodbMistralServiceManifest;
