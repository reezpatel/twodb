import type { ViewPluginManifest } from "@twodb/contracts";
import { ollamaCloudManifest } from "../shared/manifest";
import { TwodbOllamaCloudPlugin } from "./plugin";

const TwodbOllamaCloudViewManifest: ViewPluginManifest = {
	...ollamaCloudManifest,
	plugin: new TwodbOllamaCloudPlugin(),
};

export default TwodbOllamaCloudViewManifest;

export { OllamaCloudConfigurator } from "./configurator";
