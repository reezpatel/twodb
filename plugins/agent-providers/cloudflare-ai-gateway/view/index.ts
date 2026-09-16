import type { ViewPluginManifest } from "@twodb/contracts";
import { cloudflareAiGatewayManifest } from "../shared/manifest";
import { TwodbCloudflareAIGatewayPlugin } from "./plugin";

const TwodbCloudflareAIGatewayViewManifest: ViewPluginManifest = {
	...cloudflareAiGatewayManifest,
	plugin: new TwodbCloudflareAIGatewayPlugin(),
};

export default TwodbCloudflareAIGatewayViewManifest;

export { CloudflareAIGatewayConfigurator } from "./configurator";
