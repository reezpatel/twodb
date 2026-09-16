import type { ViewPluginManifest } from "@twodb/contracts";
import { cerebrasManifest } from "../shared/manifest";
import { TwodbCerebrasPlugin } from "./plugin";

const TwodbCerebrasViewManifest: ViewPluginManifest = {
	...cerebrasManifest,
	plugin: new TwodbCerebrasPlugin(),
};

export default TwodbCerebrasViewManifest;

export { CerebrasConfigurator } from "./configurator";
