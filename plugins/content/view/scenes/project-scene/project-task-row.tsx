import type { ContentRowDto } from "@twodb/contracts";
import { Check, Paperclip } from "lucide-react";
import { projectTaskRowStyles } from "./project-task-row.style";

const URGENCIES = ["critical", "moderate", "minor"] as const;
const URGENCY_LABELS = {
	critical: "Critical",
	moderate: "Moderate",
	minor: "Minor",
} as const;

const ASSIGNEE_COLORS = ["orange", "purple", "teal", "pink"] as const;

function hashOf(id: string): number {
	let h = 0;
	for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
	return h;
}

// Mock until urgency/assignee become real columns.
function mockUrgency(id: string) {
	return URGENCIES[hashOf(id) % URGENCIES.length];
}

function mockAssignee(createdBy: string) {
	const clean = createdBy.replace(/[^a-z0-9]/gi, "");
	return {
		initials: clean.slice(0, 2).toUpperCase() || "??",
		color: ASSIGNEE_COLORS[hashOf(createdBy) % ASSIGNEE_COLORS.length],
	};
}

type ProjectTaskRowProps = {
	note: ContentRowDto;
	selected: boolean;
	onSelect: (id: string) => void;
	onToggleCompleted: (id: string, completed: boolean) => void;
};

export function ProjectTaskRow({
	note,
	selected,
	onSelect,
	onToggleCompleted,
}: ProjectTaskRowProps) {
	const urgency = mockUrgency(note.id);
	const assignee = mockAssignee(note.created_by);

	return (
		<div
			className={`project-row${selected ? " is-selected" : ""}${note.completed ? " is-done" : ""}`}
			onClick={() => onSelect(note.id)}
		>
			<style jsx>{projectTaskRowStyles}</style>

			<div className="project-row__task-cell">
				<span
					className={`project-row__checkbox${note.completed ? " is-checked" : ""}`}
					onClick={(e) => {
						e.stopPropagation();
						onToggleCompleted(note.id, !note.completed);
					}}
				>
					{note.completed && <Check aria-hidden="true" />}
				</span>
				<span className="project-row__task-id">{note.id}</span>
				<span className="project-row__task-title">{note.title}</span>
				{note.attachments.length > 0 && (
					<span className="project-row__task-attachments">
						<Paperclip aria-hidden="true" />
						{note.attachments.length}
					</span>
				)}
			</div>

			<span
				className={`project-row__progress project-row__progress--${note.completed ? "completed" : "ongoing"}`}
			>
				<span className="project-row__progress-icon">
					{note.completed ? "✓" : "⚡"}
				</span>
				{note.completed ? "Completed" : "Ongoing"}
			</span>

			<span className={`project-row__urgency project-row__urgency--${urgency}`}>
				<span className="project-row__urgency-bars">
					<span className="project-row__urgency-bar" />
					<span className="project-row__urgency-bar" />
					<span className="project-row__urgency-bar" />
				</span>
				{URGENCY_LABELS[urgency]}
			</span>

			<span className="project-row__assignees">
				<span
					className={`project-row__assignee project-row__assignee--${assignee.color}`}
				>
					{assignee.initials}
				</span>
			</span>
		</div>
	);
}
