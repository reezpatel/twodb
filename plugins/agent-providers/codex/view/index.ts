import type { ViewPluginManifest } from "@twodb/contracts";
import { codexManifest } from "../shared/manifest";
import { TwodbCodexPlugin } from "./plugin";

const TwodbCodexViewManifest: ViewPluginManifest = {
	...codexManifest,
	plugin: new TwodbCodexPlugin(),
};

export default TwodbCodexViewManifest;

export { CodexConfigurator } from "./configurator";
