import { rootServicePlugin } from "@twodb/shared-backend";
import { xaiManifest } from "../shared/manifest";

export const TwodbXaiServiceManifest = {
	...xaiManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-xai-service",
		async () => {},
	),
};

export const service = TwodbXaiServiceManifest;

export default TwodbXaiServiceManifest;
