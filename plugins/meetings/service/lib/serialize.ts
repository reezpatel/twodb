import type {
	MeetingDto,
	MeetingParticipantDto,
	MeetingRecordingDto,
	MeetingSummaryDto,
	TranscriptSegmentDto,
} from "@twodb/contracts";
import type { Selectable } from "kysely";
import type {
	MtMeetingParticipantsTable,
	MtMeetingsTable,
	MtMeetingSummariesTable,
	MtRecordingsTable,
	MtTranscriptSegmentsTable,
} from "../db/schema";

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function toMeetingDto(row: Selectable<MtMeetingsTable>): MeetingDto {
	return {
		id: row.id,
		workspace_id: row.workspace_id,
		title: row.title,
		context: row.context,
		status: row.status,
		scheduled_start: iso(row.scheduled_start),
		started_at: iso(row.started_at),
		ended_at: iso(row.ended_at),
		created_by: row.created_by,
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
	};
}

export function toParticipantDto(
	row: Selectable<MtMeetingParticipantsTable>,
): MeetingParticipantDto {
	return {
		id: row.id,
		meeting_id: row.meeting_id,
		user_id: row.user_id,
		name: row.name,
		email: row.email,
		role: row.role,
		state: row.state,
		joined_at: iso(row.joined_at),
		left_at: iso(row.left_at),
	};
}

export function toRecordingDto(
	row: Selectable<MtRecordingsTable>,
): MeetingRecordingDto {
	return {
		id: row.id,
		meeting_id: row.meeting_id,
		workspace_id: row.workspace_id,
		kind: row.kind,
		status: row.status,
		storage_key: row.storage_key,
		duration_ms: row.duration_ms,
		size_bytes: row.size_bytes,
		started_by: row.started_by,
		started_at: row.started_at.toISOString(),
		ended_at: iso(row.ended_at),
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
	};
}

export function toSegmentDto(
	row: Selectable<MtTranscriptSegmentsTable>,
): TranscriptSegmentDto {
	return {
		id: row.id,
		meeting_id: row.meeting_id,
		recording_id: row.recording_id,
		participant_id: row.participant_id,
		speaker_name: row.speaker_name,
		start_ms: row.start_ms,
		end_ms: row.end_ms,
		text: row.text,
		language: row.language,
		created_at: row.created_at.toISOString(),
	};
}

export function toSummaryDto(
	row: Selectable<MtMeetingSummariesTable>,
): MeetingSummaryDto {
	return {
		meeting_id: row.meeting_id,
		overview: row.overview,
		key_points: (row.key_points ?? []) as string[],
		action_items: (row.action_items ?? []) as MeetingSummaryDto["action_items"],
		model: row.model,
		generated_at: row.generated_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
	};
}
