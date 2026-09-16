import type { ViewPluginManifest } from "@twodb/contracts";
import { calendarManifest } from "../shared/manifest";
import { TwodbCalendarPlugin } from "./plugin";

const TwodbCalendarViewManifest: ViewPluginManifest = {
	...calendarManifest,
	plugin: new TwodbCalendarPlugin(),
};

export default TwodbCalendarViewManifest;
