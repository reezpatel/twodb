import type { ViewPluginManifest } from "@twodb/contracts";
import { meetingsManifest } from "../shared/manifest";
import { TwodbMeetingsPlugin } from "./plugin";

const TwodbMeetingsViewManifest: ViewPluginManifest = {
	...meetingsManifest,
	plugin: new TwodbMeetingsPlugin(),
};

export default TwodbMeetingsViewManifest;
