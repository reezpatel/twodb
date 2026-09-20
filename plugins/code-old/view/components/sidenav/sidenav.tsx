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
import {
	useArchivedSessions,
	useSessionGroups,
	type SessionItemStatus,
} from "../../hooks/use-sessions.hook";
import { ManageDialog } from "./manage-dialog";
import { ProjectSelectorDialog } from "../../scene/code/project-selector-dialog";
import { codeSidenavStyles } from "./sidenav.style";

function StatusIcon({ status }: { status: SessionItemStatus }) {
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
	hideHeader = false,
}: {
	selectedId: string;
	onSelect: (id: string) => void;
	/** Panes that provide their own header (e.g. the project bar) skip this. */
	hideHeader?: boolean;
}) {
	const [archiveOpen, setArchiveOpen] = useState(false);
	const [manageOpen, setManageOpen] = useState(false);
	const [newProjectOpen, setNewProjectOpen] = useState(false);
	const { groups } = useSessionGroups();
	const { sessions: archivedSessions } = useArchivedSessions();

	return (
		<aside className="code-sidenav">
			<style jsx>{codeSidenavStyles}</style>
			{hideHeader ? null : (
				<div className="code-sidenav__header">
					<span className="code-sidenav__title">Agents</span>
					<div className="code-sidenav__actions">
						<button
							className="code-sidenav__action"
							aria-label="New session"
							onClick={() => setNewProjectOpen(true)}
						>
							<Plus size={16} aria-hidden="true" />
						</button>
						<button className="code-sidenav__action" aria-label="Filter">
							<Filter size={16} aria-hidden="true" />
						</button>
					</div>
				</div>
			)}

			<div className="code-sidenav__folders">
				{groups.map((folder) => (
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

				{groups.length === 0 ? (
					<div className="code-sidenav__empty">
						No sessions yet — hit + to start one.
					</div>
				) : null}

				{archiveOpen ? (
					<div className="code-sidenav__folder">
						<div className="code-sidenav__folder-header">
							<Archive size={14} aria-hidden="true" />
							Archived
							<span className="code-sidenav__folder-count">
								{archivedSessions.length}
							</span>
						</div>
						{archivedSessions.map((session) => (
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
					<span className="code-sidenav__folder-count">
						{archivedSessions.length}
					</span>
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
			<ProjectSelectorDialog
				open={newProjectOpen}
				onClose={() => setNewProjectOpen(false)}
			/>
		</aside>
	);
}
