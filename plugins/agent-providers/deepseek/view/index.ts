import type { ViewPluginManifest } from "@twodb/contracts";
import { deepseekManifest } from "../shared/manifest";
import { TwodbDeepSeekPlugin } from "./plugin";

const TwodbDeepSeekViewManifest: ViewPluginManifest = {
	...deepseekManifest,
	plugin: new TwodbDeepSeekPlugin(),
};

export default TwodbDeepSeekViewManifest;

export { DeepSeekConfigurator } from "./configurator";
