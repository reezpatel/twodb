import type { ViewPluginManifest } from "@twodb/contracts";
import { customOpenaiManifest } from "../shared/manifest";
import { TwodbCustomOpenAIPlugin } from "./plugin";

const TwodbCustomOpenAIViewManifest: ViewPluginManifest = {
	...customOpenaiManifest,
	plugin: new TwodbCustomOpenAIPlugin(),
};

export default TwodbCustomOpenAIViewManifest;

export { CustomOpenAIConfigurator } from "./configurator";
