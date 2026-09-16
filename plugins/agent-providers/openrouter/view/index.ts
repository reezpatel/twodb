import type { ViewPluginManifest } from "@twodb/contracts";
import { openrouterManifest } from "../shared/manifest";
import { TwodbOpenRouterPlugin } from "./plugin";

const TwodbOpenRouterViewManifest: ViewPluginManifest = {
	...openrouterManifest,
	plugin: new TwodbOpenRouterPlugin(),
};

export default TwodbOpenRouterViewManifest;

export { OpenRouterConfigurator } from "./configurator";
