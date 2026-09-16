import type { ViewPluginManifest } from "@twodb/contracts";
import { anthropicManifest } from "../shared/manifest";
import { TwodbAnthropicPlugin } from "./plugin";

const TwodbAnthropicViewManifest: ViewPluginManifest = {
	...anthropicManifest,
	plugin: new TwodbAnthropicPlugin(),
};

export default TwodbAnthropicViewManifest;

export { AnthropicConfigurator } from "./configurator";
