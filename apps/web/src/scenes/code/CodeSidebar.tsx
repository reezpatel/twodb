import {
	Check,
	Circle,
	Code2,
	Filter,
	Folder,
	GitBranch,
	Loader2,
	Tag,
} from "lucide-react";
import { codeSceneStyles } from "./CodeScene.style.jsx";
import type { Issue } from "./CodeScene";

const SECTIONS = [
	{ id: "backlog", label: "Backlog" },
	{ id: "planning", label: "Planning & Implementation" },
	{ id: "done", label: "Done" },
] as const;

const HEADER_ACTIONS = [
	{ id: "git", icon: GitBranch },
	{ id: "folder", icon: Folder },
	{ id: "github", icon: Code2 },
	{ id: "tags", icon: Tag },
	{ id: "filter", icon: Filter },
];

export function CodeSidebar({
	issues,
	selectedId,
	onSelect,
}: {
	issues: Issue[];
	selectedId: string;
	onSelect: (id: string) => void;
}) {
	return (
		<aside className="mock-ai-editor__sidebar">
			<style jsx>{codeSceneStyles}</style>
			<div className="mock-ai-editor__sidebar-header">
				<span className="mock-ai-editor__project-name">my-project</span>
				<div className="mock-ai-editor__header-actions">
					{HEADER_ACTIONS.map((action) => (
						<button
							key={action.id}
							className="mock-ai-editor__header-btn"
							aria-label={action.id}
						>
							<action.icon size={16} aria-hidden="true" />
						</button>
					))}
				</div>
			</div>

			<div className="mock-ai-editor__sections">
				{SECTIONS.map((section) => {
					const sectionIssues = issues.filter((i) => i.section === section.id);
					if (sectionIssues.length === 0) return null;
					return (
						<div key={section.id} className="mock-ai-editor__section">
							<div className="mock-ai-editor__section-header">
								{section.label}
								<span className="mock-ai-editor__section-count">
									{sectionIssues.length}
								</span>
							</div>
							{sectionIssues.map((issue) => (
								<div
									key={issue.id}
									className={`mock-ai-editor__issue${selectedId === issue.id ? " is-selected" : ""}`}
									onClick={() => onSelect(issue.id)}
								>
									<span className="mock-ai-editor__issue-id">
										#{issue.number}
									</span>
									{issue.status === "done" ? (
										<span className="mock-ai-editor__issue-status mock-ai-editor__issue-status--done">
											<Check size={14} aria-hidden="true" />
										</span>
									) : issue.status === "progress" ? (
										<span className="mock-ai-editor__issue-status mock-ai-editor__issue-status--progress">
											<Loader2 size={14} aria-hidden="true" />
										</span>
									) : (
										<span className="mock-ai-editor__issue-status">
											<Circle size={14} aria-hidden="true" />
										</span>
									)}
									<span className="mock-ai-editor__issue-title">
										{issue.title}
									</span>
									{issue.type ? (
										<span
											className={`mock-ai-editor__issue-badge mock-ai-editor__issue-badge--${issue.type}`}
										>
											{issue.type === "feature" ? "Feature" : "Bug"}
										</span>
									) : null}
									{issue.status !== "done" ? (
										<span className="mock-ai-editor__issue-circle" />
									) : null}
								</div>
							))}
						</div>
					);
				})}
			</div>
		</aside>
	);
}
