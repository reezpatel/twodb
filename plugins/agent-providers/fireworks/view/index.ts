import type { ViewPluginManifest } from "@twodb/contracts";
import { fireworksManifest } from "../shared/manifest";
import { TwodbFireworksPlugin } from "./plugin";

const TwodbFireworksViewManifest: ViewPluginManifest = {
	...fireworksManifest,
	plugin: new TwodbFireworksPlugin(),
};

export default TwodbFireworksViewManifest;

export { FireworksConfigurator } from "./configurator";
