import type { ViewPluginManifest } from "@twodb/contracts";
import { mistralManifest } from "../shared/manifest";
import { TwodbMistralPlugin } from "./plugin";

const TwodbMistralViewManifest: ViewPluginManifest = {
	...mistralManifest,
	plugin: new TwodbMistralPlugin(),
};

export default TwodbMistralViewManifest;

export { MistralConfigurator } from "./configurator";
