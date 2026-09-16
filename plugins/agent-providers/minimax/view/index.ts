import type { ViewPluginManifest } from "@twodb/contracts";
import { minimaxManifest } from "../shared/manifest";
import { TwodbMiniMaxPlugin } from "./plugin";

const TwodbMiniMaxViewManifest: ViewPluginManifest = {
	...minimaxManifest,
	plugin: new TwodbMiniMaxPlugin(),
};

export default TwodbMiniMaxViewManifest;

export { MiniMaxConfigurator } from "./configurator";
