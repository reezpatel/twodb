import type { TwodbFastifyInstance } from "@twodb/contracts";
import type { CalendarCtx } from "../lib/ctx";
import { registerAccountRoutes } from "./accounts";
import { registerCalendarRoutes } from "./calendars";
import { registerEventRoutes } from "./events";
import { registerIcsRoutes } from "./ics";

export function registerRoutes(
	fastify: TwodbFastifyInstance,
	ctx: CalendarCtx,
): void {
	registerAccountRoutes(fastify, ctx);
	registerCalendarRoutes(fastify, ctx);
	registerEventRoutes(fastify, ctx);
	registerIcsRoutes(fastify, ctx);
}
