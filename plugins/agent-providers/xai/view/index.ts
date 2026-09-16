import type { ViewPluginManifest } from "@twodb/contracts";
import { xaiManifest } from "../shared/manifest";
import { TwodbXaiPlugin } from "./plugin";

const TwodbXaiViewManifest: ViewPluginManifest = {
	...xaiManifest,
	plugin: new TwodbXaiPlugin(),
};

export default TwodbXaiViewManifest;

export { XaiConfigurator } from "./configurator";
