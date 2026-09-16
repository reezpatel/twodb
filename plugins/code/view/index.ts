import type { ViewPluginManifest } from "../../../packages/contracts/src/plugin";
import { codeManifest } from "../shared/manifest";
import { TwodbCodePlugin } from "./plugin";

const TwodbCodeViewManifest: ViewPluginManifest = {
	...codeManifest,
	plugin: new TwodbCodePlugin(),
};

export default TwodbCodeViewManifest;
