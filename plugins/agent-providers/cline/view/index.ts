import type { ViewPluginManifest } from "@twodb/contracts";
import { clineManifest } from "../shared/manifest";
import { TwodbClinePlugin } from "./plugin";

const TwodbClineViewManifest: ViewPluginManifest = {
	...clineManifest,
	plugin: new TwodbClinePlugin(),
};

export default TwodbClineViewManifest;

export { ClineConfigurator } from "./configurator";
