import type { CalendarConnector } from "../types";
import { caldavConnector } from "./caldav";
import { googleCalendarConnector } from "./google";
import { graphCalendarConnector } from "./graph";

export function calendarConnectorFor(kind: string): CalendarConnector {
  if (kind === "google") return googleCalendarConnector;
  if (kind === "microsoft") return graphCalendarConnector;
  if (kind === "imap") return caldavConnector;
  throw new Error(`unknown calendar connector "${kind}"`);
}
