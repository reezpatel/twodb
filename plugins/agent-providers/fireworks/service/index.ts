import { rootServicePlugin } from "@twodb/shared-backend";
import { fireworksManifest } from "../shared/manifest";

export const TwodbFireworksServiceManifest = {
	...fireworksManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-fireworks-service",
		async () => {},
	),
};

export const service = TwodbFireworksServiceManifest;

export default TwodbFireworksServiceManifest;
