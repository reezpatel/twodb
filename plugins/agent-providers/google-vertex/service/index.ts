import { rootServicePlugin } from "@twodb/shared-backend";
import { googleVertexManifest } from "../shared/manifest";

export const TwodbGoogleVertexServiceManifest = {
	...googleVertexManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-google-vertex-service",
		async () => {},
	),
};

export const service = TwodbGoogleVertexServiceManifest;

export default TwodbGoogleVertexServiceManifest;
