import type { ViewPluginManifest } from "@twodb/contracts";
import { amazonBedrockManifest } from "../shared/manifest";
import { TwodbAmazonBedrockPlugin } from "./plugin";

const TwodbAmazonBedrockViewManifest: ViewPluginManifest = {
	...amazonBedrockManifest,
	plugin: new TwodbAmazonBedrockPlugin(),
};

export default TwodbAmazonBedrockViewManifest;

export { AmazonBedrockConfigurator } from "./configurator";
