import { useState } from "react";
import {
	ChevronUp,
	Circle,
	Flag,
	Folder,
	GitBranch,
	Link,
	RefreshCw,
	Tag,
	User,
} from "lucide-react";
import { codeSceneStyles } from "./code-scene.style";

const WORKFLOW_ITEMS = [
	{ id: "backlog", label: "Backlog", icon: Circle },
	{ id: "labels", label: "Labels", icon: Tag },
	{ id: "deps", label: "Dependencies", icon: Link },
	{ id: "assignee", label: "Ava Elizabeth", icon: User },
];

const SESSION_ITEMS = [
	{ id: "api", label: "api", icon: Folder },
	{ id: "worktree", label: "No worktree", icon: GitBranch },
	{ id: "flag", label: "1 flag", icon: Flag },
];

const GIT_FILES = [
	{ name: "server.ts", additions: 12, deletions: 2 },
	{ name: "db.ts", additions: 8, deletions: 1 },
];

const SECTIONS = ["workflow", "session", "git", "stats"] as const;
type SectionId = (typeof SECTIONS)[number];

export function CodePanel() {
	const [open, setOpen] = useState<Record<SectionId, boolean>>({
		workflow: true,
		session: true,
		git: true,
		stats: true,
	});

	const toggle = (id: SectionId) =>
		setOpen((cur) => ({ ...cur, [id]: !cur[id] }));

	return (
		<aside className="mock-ai-editor__panel">
			<style jsx>{codeSceneStyles}</style>

			<div className="mock-ai-editor__panel-section">
				<div
					className="mock-ai-editor__panel-header"
					onClick={() => toggle("workflow")}
				>
					<span className="mock-ai-editor__panel-title">Workflow</span>
					<span
						className="mock-ai-editor__panel-toggle"
						style={{
							transform: open.workflow ? "rotate(0deg)" : "rotate(180deg)",
						}}
					>
						<ChevronUp size={16} aria-hidden="true" />
					</span>
				</div>
				{open.workflow ? (
					<div className="mock-ai-editor__panel-items">
						{WORKFLOW_ITEMS.map((item) => (
							<div key={item.id} className="mock-ai-editor__panel-item">
								<item.icon size={14} aria-hidden="true" />
								{item.label}
							</div>
						))}
					</div>
				) : null}
			</div>

			<div className="mock-ai-editor__panel-section">
				<div
					className="mock-ai-editor__panel-header"
					onClick={() => toggle("session")}
				>
					<span className="mock-ai-editor__panel-title">Session</span>
					<span
						className="mock-ai-editor__panel-toggle"
						style={{
							transform: open.session ? "rotate(0deg)" : "rotate(180deg)",
						}}
					>
						<ChevronUp size={16} aria-hidden="true" />
					</span>
				</div>
				{open.session ? (
					<div className="mock-ai-editor__panel-items">
						{SESSION_ITEMS.map((item) => (
							<div key={item.id} className="mock-ai-editor__panel-item">
								<item.icon size={14} aria-hidden="true" />
								{item.label}
							</div>
						))}
					</div>
				) : null}
			</div>

			<div className="mock-ai-editor__panel-section">
				<div
					className="mock-ai-editor__panel-header"
					onClick={() => toggle("git")}
				>
					<span className="mock-ai-editor__panel-title">
						Git Summary ({GIT_FILES.length})
					</span>
					<span
						className="mock-ai-editor__panel-toggle"
						style={{
							transform: open.git ? "rotate(0deg)" : "rotate(180deg)",
						}}
					>
						<ChevronUp size={16} aria-hidden="true" />
					</span>
				</div>
				{open.git ? (
					<div className="mock-ai-editor__panel-items">
						<div className="mock-ai-editor__branch-row">
							<GitBranch size={14} aria-hidden="true" />
							<span className="mock-ai-editor__branch-name">main</span>
							<button
								className="mock-ai-editor__branch-refresh"
								aria-label="Refresh"
							>
								<RefreshCw size={14} aria-hidden="true" />
							</button>
						</div>
						{GIT_FILES.map((file) => (
							<div key={file.name} className="mock-ai-editor__git-file">
								<span className="mock-ai-editor__git-file-icon">M</span>
								<span className="mock-ai-editor__git-file-name">
									{file.name}
								</span>
								<span className="mock-ai-editor__git-file-stats">
									<span className="mock-ai-editor__git-add">
										+{file.additions}
									</span>
									<span className="mock-ai-editor__git-del">
										-{file.deletions}
									</span>
								</span>
							</div>
						))}
					</div>
				) : null}
			</div>

			<div className="mock-ai-editor__panel-section">
				<div
					className="mock-ai-editor__panel-header"
					onClick={() => toggle("stats")}
				>
					<span className="mock-ai-editor__panel-title">Statistics</span>
					<span
						className="mock-ai-editor__panel-toggle"
						style={{
							transform: open.stats ? "rotate(0deg)" : "rotate(180deg)",
						}}
					>
						<ChevronUp size={16} aria-hidden="true" />
					</span>
				</div>
				{open.stats ? (
					<div className="mock-ai-editor__panel-items">
						<div className="mock-ai-editor__stat-row">
							<span className="mock-ai-editor__stat-label">Total tokens</span>
							<span className="mock-ai-editor__stat-value">8.2k</span>
						</div>
					</div>
				) : null}
			</div>
		</aside>
	);
}
