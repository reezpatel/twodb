export const PLUGIN_ID = "io.twodb.calendar";

export const CALENDAR_PROVIDERS = [
	"local",
	"google",
	"microsoft",
	"caldav",
	"ics",
] as const;

export const EVENT_STATUSES = ["confirmed", "tentative", "cancelled"] as const;

export const RSVP_STATUSES = [
	"needs_action",
	"accepted",
	"declined",
	"tentative",
] as const;

export const ATTENDEE_ROLES = ["organizer", "required", "optional"] as const;

export const REMINDER_METHODS = ["popup", "email", "push"] as const;
