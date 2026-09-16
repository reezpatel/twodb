/**
 * Meetings plugin contracts — DTOs shared by the service (responses) and the
 * view (rendering), plus the plugin's event map.
 */

export type MeetingStatus = "scheduled" | "live" | "ended" | "cancelled";

export type MeetingParticipantRole = "host" | "participant" | "guest";

export type MeetingParticipantState = "invited" | "joined" | "left";

export type RecordingKind = "audio" | "video" | "screen";

export type RecordingStatus = "recording" | "processing" | "ready" | "failed";

export interface MeetingDto {
	id: string;
	workspace_id: string;
	title: string;
	/** Secondary line under the title, e.g. "City Clinic weekly review". */
	context: string | null;
	status: MeetingStatus;
	scheduled_start: string | null;
	started_at: string | null;
	ended_at: string | null;
	created_by: string;
	created_at: string;
	updated_at: string;
}

export interface MeetingParticipantDto {
	id: string;
	meeting_id: string;
	user_id: string | null;
	name: string;
	email: string | null;
	role: MeetingParticipantRole;
	state: MeetingParticipantState;
	joined_at: string | null;
	left_at: string | null;
}

export interface MeetingRecordingDto {
	id: string;
	meeting_id: string;
	workspace_id: string;
	kind: RecordingKind;
	status: RecordingStatus;
	/** Object-storage pointer (storage plugin) once the artifact lands. */
	storage_key: string | null;
	duration_ms: number | null;
	size_bytes: number | null;
	started_by: string;
	started_at: string;
	ended_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface TranscriptSegmentDto {
	id: string;
	meeting_id: string;
	recording_id: string | null;
	participant_id: string | null;
	speaker_name: string;
	start_ms: number;
	end_ms: number | null;
	text: string;
	language: string;
	created_at: string;
}

export interface MeetingSummaryDto {
	meeting_id: string;
	overview: string;
	key_points: string[];
	/** Free-form action items: { text, assignee? } rows. */
	action_items: { text: string; assignee?: string | null }[];
	model: string | null;
	generated_at: string;
	updated_at: string;
}

/** GET /meetings/:id detail payload — everything the scene needs at once. */
export interface MeetingDetailDto {
	meeting: MeetingDto;
	participants: MeetingParticipantDto[];
	recordings: MeetingRecordingDto[];
	summary: MeetingSummaryDto | null;
}

export type MeetingsEventMap = {
	"io.twodb.meetings.meeting.created": {
		workspace_id: string;
		meeting: MeetingDto;
	};
	"io.twodb.meetings.meeting.updated": {
		workspace_id: string;
		meeting: MeetingDto;
	};
	"io.twodb.meetings.recording.started": {
		workspace_id: string;
		recording: MeetingRecordingDto;
	};
	"io.twodb.meetings.recording.stopped": {
		workspace_id: string;
		recording: MeetingRecordingDto;
	};
	"io.twodb.meetings.transcript.appended": {
		workspace_id: string;
		meeting_id: string;
		segments: TranscriptSegmentDto[];
	};
	"io.twodb.meetings.summary.generated": {
		workspace_id: string;
		summary: MeetingSummaryDto;
	};
};
