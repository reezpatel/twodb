import type { ViewPluginManifest } from "@twodb/contracts";
import { googleVertexManifest } from "../shared/manifest";
import { TwodbGoogleVertexPlugin } from "./plugin";

const TwodbGoogleVertexViewManifest: ViewPluginManifest = {
	...googleVertexManifest,
	plugin: new TwodbGoogleVertexPlugin(),
};

export default TwodbGoogleVertexViewManifest;

export { GoogleVertexConfigurator } from "./configurator";
