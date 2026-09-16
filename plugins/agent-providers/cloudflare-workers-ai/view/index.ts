import type { ViewPluginManifest } from "@twodb/contracts";
import { cloudflareWorkersAiManifest } from "../shared/manifest";
import { TwodbCloudflareWorkersAIPlugin } from "./plugin";

const TwodbCloudflareWorkersAIViewManifest: ViewPluginManifest = {
	...cloudflareWorkersAiManifest,
	plugin: new TwodbCloudflareWorkersAIPlugin(),
};

export default TwodbCloudflareWorkersAIViewManifest;

export { CloudflareWorkersAIConfigurator } from "./configurator";
