import { z } from "zod";
import { defineAppManifest, defineEndpoint } from "@twodb/core-platform/manifest";
export const calendarInput = z.object({ spaceId: z.string().min(1), name: z.string().trim().min(1).max(200), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#235d42") });
const timed = z.string().datetime({ offset: true }).transform(v => new Date(v).toISOString());
const date = z.string().date();
const eventFields = z.object({ calendarId: z.string().min(1), title: z.string().trim().min(1).max(300), description: z.string().max(20000).default(""), location: z.string().max(1000).default(""), allDay: z.boolean().default(false), startAt: timed.nullable().default(null), endAt: timed.nullable().default(null), startDate: date.nullable().default(null), endDate: date.nullable().default(null) });
export const eventInput = eventFields.superRefine((v, ctx) => {
  if (v.allDay ? (!v.startDate || !v.endDate || v.endDate <= v.startDate || v.startAt !== null || v.endAt !== null) : (!v.startAt || !v.endAt || v.endAt <= v.startAt || v.startDate !== null || v.endDate !== null)) ctx.addIssue({ code: "custom", message: "Provide an exclusive end after start; all-day events use dates only, timed events use timestamps only." });
});
export const rangeQuery = z.object({ calendarId: z.string().optional(), from: date, to: date, limit: z.coerce.number().int().min(1).max(500).default(500), offset: z.coerce.number().int().min(0).default(0) }).refine(v => v.to > v.from && (Date.parse(v.to) - Date.parse(v.from)) <= 366 * 86400000, "Range must be positive and at most 366 days");
const calendar = calendarInput.extend({ id: z.string(), createdAt: z.string() });
const event = eventFields.extend({ id: z.string(), createdAt: z.string(), updatedAt: z.string() });
const auth = "session-or-apiKey" as const;
export const manifest = defineAppManifest({ name: "TwoDay", slug: "twoday", version: "0.1.0", shape: "backend+webapp", description: "Space-scoped calendars and local events.", capabilities: [], coreDeps: ["core-data", "core-platform", "core-async"], basePath: "/apps/twoday", endpoints: [
  defineEndpoint({ name: "listCalendars", method: "GET", path: "/calendars", auth, description: "List calendars in accessible spaces.", response: z.array(calendar) }),
  defineEndpoint({ name: "createCalendar", method: "POST", path: "/calendars", auth, description: "Create a calendar in an accessible space.", request: calendarInput, response: calendar }),
  defineEndpoint({ name: "listEvents", method: "GET", path: "/events", auth, description: "List overlapping events. Required from/to are YYYY-MM-DD UTC boundaries (to exclusive); optional calendarId, limit (max 500), offset. All-day overlap uses date boundaries.", response: z.array(event) }),
  defineEndpoint({ name: "createEvent", method: "POST", path: "/events", auth, description: "Create a local event. No invitations are sent. End is exclusive.", request: eventInput, response: event }),
  defineEndpoint({ name: "replaceEvent", method: "PUT", path: "/events/:id", auth, description: "Replace event fields; calendarId cannot change.", request: eventInput, response: event }),
  defineEndpoint({ name: "deleteEvent", method: "DELETE", path: "/events/:id", auth, description: "Permanently delete a local event.", response: z.object({ ok: z.boolean() }) }),
] });
export default manifest;
