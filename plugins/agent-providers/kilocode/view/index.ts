import type { ViewPluginManifest } from "@twodb/contracts";
import { kilocodeManifest } from "../shared/manifest";
import { TwodbKiloCodePlugin } from "./plugin";

const TwodbKiloCodeViewManifest: ViewPluginManifest = {
	...kilocodeManifest,
	plugin: new TwodbKiloCodePlugin(),
};

export default TwodbKiloCodeViewManifest;

export { KiloCodeConfigurator } from "./configurator";
