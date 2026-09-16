import type { ViewPluginManifest } from "@twodb/contracts";
import { azureOpenaiManifest } from "../shared/manifest";
import { TwodbAzureOpenAIPlugin } from "./plugin";

const TwodbAzureOpenAIViewManifest: ViewPluginManifest = {
	...azureOpenaiManifest,
	plugin: new TwodbAzureOpenAIPlugin(),
};

export default TwodbAzureOpenAIViewManifest;

export { AzureOpenAIConfigurator } from "./configurator";
