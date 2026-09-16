import type { ViewPluginManifest } from "@twodb/contracts";
import { googleManifest } from "../shared/manifest";
import { TwodbGoogleGeminiPlugin } from "./plugin";

const TwodbGoogleGeminiViewManifest: ViewPluginManifest = {
	...googleManifest,
	plugin: new TwodbGoogleGeminiPlugin(),
};

export default TwodbGoogleGeminiViewManifest;

export { GoogleGeminiConfigurator } from "./configurator";
