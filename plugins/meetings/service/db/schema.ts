import type {
	MeetingParticipantRole,
	MeetingParticipantState,
	MeetingStatus,
	RecordingKind,
	RecordingStatus,
} from "@twodb/contracts";
import type { Generated } from "kysely";

export interface MtMeetingsTable {
	id: string;
	workspace_id: string;
	title: string;
	context: string | null;
	status: Generated<MeetingStatus>;
	scheduled_start: Date | null;
	started_at: Generated<Date | null>;
	ended_at: Generated<Date | null>;
	created_by: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface MtMeetingParticipantsTable {
	id: string;
	meeting_id: string;
	user_id: string | null;
	name: string;
	email: string | null;
	role: Generated<MeetingParticipantRole>;
	state: Generated<MeetingParticipantState>;
	joined_at: Generated<Date | null>;
	left_at: Generated<Date | null>;
}

export interface MtRecordingsTable {
	id: string;
	meeting_id: string;
	workspace_id: string;
	kind: RecordingKind;
	status: Generated<RecordingStatus>;
	storage_key: Generated<string | null>;
	duration_ms: Generated<number | null>;
	size_bytes: Generated<number | null>;
	started_by: string;
	started_at: Generated<Date>;
	ended_at: Generated<Date | null>;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface MtTranscriptSegmentsTable {
	id: string;
	meeting_id: string;
	recording_id: string | null;
	participant_id: string | null;
	speaker_name: string;
	start_ms: number;
	end_ms: number | null;
	text: string;
	language: Generated<string>;
	created_at: Generated<Date>;
}

export interface MtMeetingSummariesTable {
	meeting_id: string;
	overview: string;
	/** JSON array of strings. */
	key_points: Generated<unknown>;
	/** JSON array of { text, assignee? }. */
	action_items: Generated<unknown>;
	model: string | null;
	generated_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface MeetingsDB {
	mt_meetings: MtMeetingsTable;
	mt_meeting_participants: MtMeetingParticipantsTable;
	mt_recordings: MtRecordingsTable;
	mt_transcript_segments: MtTranscriptSegmentsTable;
	mt_meeting_summaries: MtMeetingSummariesTable;
}
