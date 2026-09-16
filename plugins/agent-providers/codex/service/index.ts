import { rootServicePlugin } from "@twodb/shared-backend";
import { codexManifest } from "../shared/manifest";

export const TwodbCodexServiceManifest = {
	...codexManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-codex-service",
		async () => {},
	),
};

export const service = TwodbCodexServiceManifest;

export default TwodbCodexServiceManifest;
