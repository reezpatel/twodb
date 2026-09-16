import type { CalendarProvider } from "@twodb/contracts";
import { caldavConnector } from "./caldav";
import { googleConnector } from "./google";
import { icsFeedConnector } from "./ics-feed";
import { microsoftConnector } from "./microsoft";
import type { CalendarConnector } from "./types";

const CONNECTORS: Partial<Record<CalendarProvider, CalendarConnector>> = {
	google: googleConnector,
	microsoft: microsoftConnector,
	caldav: caldavConnector,
	ics: icsFeedConnector,
};

/** Connector for a provider; null for "local" (no remote side). */
export function connectorFor(
	provider: CalendarProvider,
): CalendarConnector | null {
	return CONNECTORS[provider] ?? null;
}
