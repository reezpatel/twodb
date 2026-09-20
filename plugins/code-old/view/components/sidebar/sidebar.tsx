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
import { codeSidebarStyles } from "./sidebar.style";
import { UsageStats } from "./usage-stats";

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

const STATS = [
	{ label: "Total tokens", value: "15.5k" },
	{ label: "Session cost", value: "$0.023" },
	{ label: "Tool calls", value: "7" },
];

const MEMORIES = [
	{
		id: "m1",
		text: "Repo uses tabs; biome formats on save.",
		scope: "project",
	},
	{
		id: "m2",
		text: "API runs on :3001, web on :5173 via /api proxy.",
		scope: "project",
	},
	{
		id: "m3",
		text: "Review diffs before committing; never force-push.",
		scope: "global",
	},
];

const SECTIONS = ["workflow", "session", "git", "stats", "memories"] as const;
type SectionId = (typeof SECTIONS)[number];

export function Sidebar() {
	const [open, setOpen] = useState<Record<SectionId, boolean>>({
		workflow: true,
		session: true,
		git: true,
		stats: true,
		memories: true,
	});

	const toggle = (id: SectionId) =>
		setOpen((cur) => ({ ...cur, [id]: !cur[id] }));

	const chevron = (id: SectionId) => (
		<span
			className="code-side__toggle"
			style={{ transform: open[id] ? "rotate(0deg)" : "rotate(180deg)" }}
		>
			<ChevronUp size={16} aria-hidden="true" />
		</span>
	);

	return (
		<aside className="code-side">
			<style jsx>{codeSidebarStyles}</style>

			<UsageStats />

			<div className="code-side__section">
				<button
					className="code-side__header"
					onClick={() => toggle("memories")}
				>
					<span className="code-side__title">Memories</span>
					{chevron("memories")}
				</button>
				{open.memories ? (
					<div className="code-side__items">
						{MEMORIES.map((memory) => (
							<div key={memory.id} className="code-side__memory">
								<span className="code-side__memory-text">{memory.text}</span>
								<span className="code-side__memory-scope">{memory.scope}</span>
							</div>
						))}
					</div>
				) : null}
			</div>

			<div className="code-side__section">
				<button
					className="code-side__header"
					onClick={() => toggle("workflow")}
				>
					<span className="code-side__title">Workflow</span>
					{chevron("workflow")}
				</button>
				{open.workflow ? (
					<div className="code-side__items">
						{WORKFLOW_ITEMS.map((item) => (
							<div key={item.id} className="code-side__item">
								<item.icon size={14} aria-hidden="true" />
								{item.label}
							</div>
						))}
					</div>
				) : null}
			</div>

			<div className="code-side__section">
				<button className="code-side__header" onClick={() => toggle("session")}>
					<span className="code-side__title">Session</span>
					{chevron("session")}
				</button>
				{open.session ? (
					<div className="code-side__items">
						{SESSION_ITEMS.map((item) => (
							<div key={item.id} className="code-side__item">
								<item.icon size={14} aria-hidden="true" />
								{item.label}
							</div>
						))}
					</div>
				) : null}
			</div>

			<div className="code-side__section">
				<button className="code-side__header" onClick={() => toggle("git")}>
					<span className="code-side__title">
						Git Summary ({GIT_FILES.length})
					</span>
					{chevron("git")}
				</button>
				{open.git ? (
					<div className="code-side__items">
						<div className="code-side__branch">
							<GitBranch size={14} aria-hidden="true" />
							<span className="code-side__branch-name">main</span>
							<button
								className="code-side__branch-refresh"
								aria-label="Refresh"
							>
								<RefreshCw size={14} aria-hidden="true" />
							</button>
						</div>
						{GIT_FILES.map((file) => (
							<div key={file.name} className="code-side__file">
								<span className="code-side__file-icon">M</span>
								<span className="code-side__file-name">{file.name}</span>
								<span className="code-side__file-stats">
									<span className="code-side__add">+{file.additions}</span>
									<span className="code-side__del">-{file.deletions}</span>
								</span>
							</div>
						))}
					</div>
				) : null}
			</div>

			<div className="code-side__section">
				<button className="code-side__header" onClick={() => toggle("stats")}>
					<span className="code-side__title">Statistics</span>
					{chevron("stats")}
				</button>
				{open.stats ? (
					<div className="code-side__items">
						{STATS.map((stat) => (
							<div key={stat.label} className="code-side__stat">
								<span className="code-side__stat-label">{stat.label}</span>
								<span className="code-side__stat-value">{stat.value}</span>
							</div>
						))}
					</div>
				) : null}
			</div>
		</aside>
	);
}
