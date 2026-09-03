import { useState } from "react";
import {
	Archive,
	Check,
	Circle,
	Filter,
	Folder,
	Loader2,
	Plus,
	SlidersHorizontal,
} from "lucide-react";
import { ManageDialog } from "./manage-dialog";
import { codeSidenavStyles } from "./sidenav.style";

type SessionStatus = "running" | "idle" | "done";

interface AgentSession {
	id: string;
	title: string;
	status: SessionStatus;
	time: string;
}

interface AgentFolder {
	id: string;
	name: string;
	sessions: AgentSession[];
}

const FOLDERS: AgentFolder[] = [
	{
		id: "api",
		name: "twodb/api",
		sessions: [
			{
				id: "s1",
				title: "Refactor rows router",
				status: "running",
				time: "2m",
			},
			{ id: "s2", title: "Fix migration order", status: "done", time: "1h" },
		],
	},
	{
		id: "web",
		name: "twodb/web",
		sessions: [
			{
				id: "s3",
				title: "Editor drag handles",
				status: "running",
				time: "12m",
			},
			{ id: "s4", title: "Kanban drop polish", status: "done", time: "3h" },
			{ id: "s5", title: "Theme token audit", status: "idle", time: "1d" },
		],
	},
	{
		id: "scripts",
		name: "personal/scripts",
		sessions: [
			{ id: "s6", title: "Backup rotation", status: "done", time: "2d" },
		],
	},
];

const ARCHIVED: AgentSession[] = [
	{ id: "a1", title: "Old auth spike", status: "done", time: "5d" },
	{ id: "a2", title: "Vite config cleanup", status: "done", time: "1w" },
	{ id: "a3", title: "Seed script v1", status: "done", time: "2w" },
	{ id: "a4", title: "Icon audit", status: "done", time: "3w" },
];

function StatusIcon({ status }: { status: SessionStatus }) {
	if (status === "running")
		return (
			<span className="code-sidenav__status code-sidenav__status--running">
				<Loader2 size={14} aria-hidden="true" />
			</span>
		);
	if (status === "done")
		return (
			<span className="code-sidenav__status code-sidenav__status--done">
				<Check size={14} aria-hidden="true" />
			</span>
		);
	return (
		<span className="code-sidenav__status">
			<Circle size={14} aria-hidden="true" />
		</span>
	);
}

export function Sidenav({
	selectedId,
	onSelect,
}: {
	selectedId: string;
	onSelect: (id: string) => void;
}) {
	const [archiveOpen, setArchiveOpen] = useState(false);
	const [manageOpen, setManageOpen] = useState(false);

	return (
		<aside className="code-sidenav">
			<style jsx>{codeSidenavStyles}</style>
			<div className="code-sidenav__header">
				<span className="code-sidenav__title">Agents</span>
				<div className="code-sidenav__actions">
					<button className="code-sidenav__action" aria-label="New session">
						<Plus size={16} aria-hidden="true" />
					</button>
					<button className="code-sidenav__action" aria-label="Filter">
						<Filter size={16} aria-hidden="true" />
					</button>
				</div>
			</div>

			<div className="code-sidenav__folders">
				{FOLDERS.map((folder) => (
					<div key={folder.id} className="code-sidenav__folder">
						<div className="code-sidenav__folder-header">
							<Folder size={14} aria-hidden="true" />
							{folder.name}
							<span className="code-sidenav__folder-count">
								{folder.sessions.length}
							</span>
						</div>
						{folder.sessions.map((session) => (
							<button
								key={session.id}
								className={`code-sidenav__session${selectedId === session.id ? " is-selected" : ""}`}
								onClick={() => onSelect(session.id)}
							>
								<StatusIcon status={session.status} />
								<span className="code-sidenav__session-title">
									{session.title}
								</span>
								<span className="code-sidenav__session-time">
									{session.time}
								</span>
							</button>
						))}
					</div>
				))}

				{archiveOpen ? (
					<div className="code-sidenav__folder">
						<div className="code-sidenav__folder-header">
							<Archive size={14} aria-hidden="true" />
							Archived
							<span className="code-sidenav__folder-count">
								{ARCHIVED.length}
							</span>
						</div>
						{ARCHIVED.map((session) => (
							<button
								key={session.id}
								className={`code-sidenav__session code-sidenav__session--archived${selectedId === session.id ? " is-selected" : ""}`}
								onClick={() => onSelect(session.id)}
							>
								<StatusIcon status={session.status} />
								<span className="code-sidenav__session-title">
									{session.title}
								</span>
								<span className="code-sidenav__session-time">
									{session.time}
								</span>
							</button>
						))}
					</div>
				) : null}
			</div>

			<div className="code-sidenav__footer">
				<button
					className={`code-sidenav__footer-btn${archiveOpen ? " is-active" : ""}`}
					onClick={() => setArchiveOpen((open) => !open)}
				>
					<Archive size={14} aria-hidden="true" />
					Archive
					<span className="code-sidenav__folder-count">{ARCHIVED.length}</span>
				</button>
				<button
					className="code-sidenav__footer-btn"
					onClick={() => setManageOpen(true)}
				>
					<SlidersHorizontal size={14} aria-hidden="true" />
					Skills & tools
				</button>
			</div>

			<ManageDialog open={manageOpen} onClose={() => setManageOpen(false)} />
		</aside>
	);
}
