import type { ViewPluginManifest } from "@twodb/contracts";
import { openaiManifest } from "../shared/manifest";
import { TwodbOpenAIPlugin } from "./plugin";

const TwodbOpenAIViewManifest: ViewPluginManifest = {
	...openaiManifest,
	plugin: new TwodbOpenAIPlugin(),
};

export default TwodbOpenAIViewManifest;

export { OpenAIConfigurator } from "./configurator";
