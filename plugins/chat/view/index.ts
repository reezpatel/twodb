import type { ViewPluginManifest } from "@twodb/contracts";
import { chatManifest } from "../shared/manifest";
import { TwodbChatPlugin } from "./plugin";

const chatViewManifest: ViewPluginManifest = {
	...chatManifest,
	plugin: new TwodbChatPlugin(),
};

export default chatViewManifest;
