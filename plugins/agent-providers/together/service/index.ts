import { rootServicePlugin } from "@twodb/shared-backend";
import { togetherManifest } from "../shared/manifest";

export const TwodbTogetherAIServiceManifest = {
	...togetherManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-together-service",
		async () => {},
	),
};

export const service = TwodbTogetherAIServiceManifest;

export default TwodbTogetherAIServiceManifest;
