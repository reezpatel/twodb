import type { ViewPluginManifest } from "@twodb/contracts";
import { groqManifest } from "../shared/manifest";
import { TwodbGroqPlugin } from "./plugin";

const TwodbGroqViewManifest: ViewPluginManifest = {
	...groqManifest,
	plugin: new TwodbGroqPlugin(),
};

export default TwodbGroqViewManifest;

export { GroqConfigurator } from "./configurator";
