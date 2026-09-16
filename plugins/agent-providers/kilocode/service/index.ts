import { rootServicePlugin } from "@twodb/shared-backend";
import { kilocodeManifest } from "../shared/manifest";

export const TwodbKiloCodeServiceManifest = {
	...kilocodeManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-kilocode-service",
		async () => {},
	),
};

export const service = TwodbKiloCodeServiceManifest;

export default TwodbKiloCodeServiceManifest;
