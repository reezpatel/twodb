import type { ViewPluginManifest } from "@twodb/contracts";
import { kimiCodeManifest } from "../shared/manifest";
import { TwodbKimiCodePlugin } from "./plugin";

const TwodbKimiCodeViewManifest: ViewPluginManifest = {
	...kimiCodeManifest,
	plugin: new TwodbKimiCodePlugin(),
};

export default TwodbKimiCodeViewManifest;

export { KimiCodeConfigurator } from "./configurator";
export type { KimiCodeAuth } from "../shared/types";
