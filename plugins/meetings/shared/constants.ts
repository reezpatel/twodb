export const PLUGIN_ID = "io.twodb.meetings";

export const MEETING_STATUSES = [
	"scheduled",
	"live",
	"ended",
	"cancelled",
] as const;

export const PARTICIPANT_ROLES = ["host", "participant", "guest"] as const;

export const PARTICIPANT_STATES = ["invited", "joined", "left"] as const;

export const RECORDING_KINDS = ["audio", "video", "screen"] as const;

export const RECORDING_STATUSES = [
	"recording",
	"processing",
	"ready",
	"failed",
] as const;
