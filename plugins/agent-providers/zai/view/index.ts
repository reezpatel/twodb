import type { ViewPluginManifest } from "@twodb/contracts";
import { zaiManifest } from "../shared/manifest";
import { TwodbZaiPlugin } from "./plugin";

const TwodbZaiViewManifest: ViewPluginManifest = {
	...zaiManifest,
	plugin: new TwodbZaiPlugin(),
};

export default TwodbZaiViewManifest;

export { ZaiConfigurator } from "./configurator";
