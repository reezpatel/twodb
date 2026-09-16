import type { ViewPluginManifest } from "@twodb/contracts";
import { togetherManifest } from "../shared/manifest";
import { TwodbTogetherAIPlugin } from "./plugin";

const TwodbTogetherAIViewManifest: ViewPluginManifest = {
	...togetherManifest,
	plugin: new TwodbTogetherAIPlugin(),
};

export default TwodbTogetherAIViewManifest;

export { TogetherAIConfigurator } from "./configurator";
