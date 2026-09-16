import type { ViewPluginManifest } from "@twodb/contracts";
import { agentManifest } from "../shared/manifest";
import { TwodbAgentPlugin } from "./plugin";

const TwodbAgentViewManifest: ViewPluginManifest = {
	...agentManifest,
	plugin: new TwodbAgentPlugin(),
};

export default TwodbAgentViewManifest;
