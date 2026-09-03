/* Notification Dialog mock — a notifications panel inspired by the supplied
   reference: header with mark-all-read and settings actions, a segmented
   View all / Files / Jobs / Invites filter with counts, and notification
   rows with presence avatars, inline project chips, invite actions, and
   downloadable file attachments. Cyclorama grammar: hairlines, dotted
   separators, flat night for the accept action, IBM Plex Sans cues. */

import { useState } from "react";
import { Avatar, Button, IconButton, Segmented } from "@twodb/ui";
import {
	CheckCheck,
	Download,
	FileText,
	Settings,
	Sparkles,
} from "lucide-react";
import "./notification-dialog.css";

/* ---------- data ---------- */

type Filter = "all" | "files" | "jobs" | "invites";

const FILTER_TABS = [
	{ id: "all", label: "View all", count: 10 },
	{ id: "files", label: "Files" },
	{ id: "jobs", label: "Jobs" },
	{ id: "invites", label: "Invites", count: 12 },
];

interface Person {
	name: string;
	avatar: string;
}

const MATHILDE: Person = {
	name: "Mathilde",
	avatar: "https://i.pravatar.cc/96?u=mathilde",
};
const ZAID: Person = {
	name: "Zaid",
	avatar: "https://i.pravatar.cc/96?u=zaid",
};
const LILY_ROSE: Person = {
	name: "Lily-Rose",
	avatar: "https://i.pravatar.cc/96?u=lilyrose",
};
const LANA: Person = {
	name: "Lana",
	avatar: "https://i.pravatar.cc/96?u=lana",
};

/* ---------- pieces ---------- */

/** Inline project chip — icon + bold name on a hairline pill. */
function Chip({
	icon,
	label,
	tone,
}: {
	icon: React.ReactNode;
	label: string;
	tone: "go" | "rose";
}) {
	return (
		<span className={`mock-nd__chip mock-nd__chip--${tone}`}>
			{icon}
			{label}
		</span>
	);
}

/** File glyph — a document outline with a colored extension tag. */
function FileGlyph({ ext, tone }: { ext: string; tone: "fig" | "mp4" }) {
	return (
		<span className="mock-nd__fileglyph" aria-hidden="true">
			<FileText size={26} strokeWidth={1.4} />
			<span className={`mock-nd__fileext mock-nd__fileext--${tone}`}>
				{ext}
			</span>
		</span>
	);
}

function FileCard({
	ext,
	tone,
	name,
	size,
}: {
	ext: string;
	tone: "fig" | "mp4";
	name: string;
	size: string;
}) {
	return (
		<div className="mock-nd__file">
			<FileGlyph ext={ext} tone={tone} />
			<span className="mock-nd__file-meta">
				<strong>{name}</strong>
				<em>{size}</em>
			</span>
			<IconButton
				label={`Download ${name}`}
				icon={<Download size={16} />}
				size="sm"
			/>
		</div>
	);
}

interface RowProps {
	person: Person;
	action: React.ReactNode;
	when: string;
	ago: string;
	unread?: boolean;
	extra?: React.ReactNode;
}

function NotificationRow({
	person,
	action,
	when,
	ago,
	unread,
	extra,
}: RowProps) {
	return (
		<article className="mock-nd__row">
			<div className="mock-nd__row-main">
				<Avatar
					name={person.name}
					src={person.avatar}
					size="lg"
					presence="online"
				/>
				<div className="mock-nd__body">
					<p className="mock-nd__title">
						<strong>{person.name}</strong> {action}
					</p>
					<p className="mock-nd__when">{when}</p>
				</div>
				<div className="mock-nd__meta">
					{unread ? (
						<span className="mock-nd__unread" aria-label="Unread" />
					) : (
						<span className="mock-nd__unread-spacer" aria-hidden="true" />
					)}
					<span className="mock-nd__ago">{ago}</span>
				</div>
			</div>
			{extra && <div className="mock-nd__extra">{extra}</div>}
		</article>
	);
}

/* ---------- main ---------- */

export function NotificationDialogMock() {
	const [filter, setFilter] = useState<Filter>("all");
	const [allRead, setAllRead] = useState(false);
	const [invite, setInvite] = useState<"pending" | "accepted" | "declined">(
		"pending",
	);

	const show = (section: Filter) => filter === "all" || filter === section;

	return (
		<div className="mock-nd">
			<section
				className="mock-nd__dialog"
				aria-label="Notifications dialog"
				role="dialog"
			>
				<header className="mock-nd__header">
					<h2>Notifications</h2>
					<div className="mock-nd__header-actions">
						<IconButton
							label="Mark all as read"
							icon={<CheckCheck size={17} />}
							onClick={() => setAllRead(true)}
						/>
						<IconButton
							label="Notification settings"
							icon={<Settings size={17} />}
						/>
					</div>
				</header>

				<div className="mock-nd__tabs">
					<Segmented
						aria-label="Filter notifications"
						items={FILTER_TABS}
						value={filter}
						onValueChange={(id) => setFilter(id as Filter)}
					/>
				</div>

				<div className="mock-nd__list">
					{show("all") && (
						<NotificationRow
							person={MATHILDE}
							action="followed you"
							when="Friday 3:04 PM"
							ago="2 hours ago"
							unread={!allRead}
						/>
					)}

					{show("invites") && (
						<NotificationRow
							person={ZAID}
							action={
								<>
									invited you to{" "}
									<Chip
										icon={<FileText size={13} />}
										label="Blog design"
										tone="go"
									/>
								</>
							}
							when="Friday 2:22 PM"
							ago="3 hours ago"
							extra={
								invite === "pending" ? (
									<div className="mock-nd__actions">
										<Button
											size="sm"
											variant="secondary"
											onClick={() => setInvite("declined")}
										>
											Decline
										</Button>
										<Button
											size="sm"
											className="mock-nd__accept"
											onClick={() => setInvite("accepted")}
										>
											Accept
										</Button>
									</div>
								) : (
									<p className="mock-nd__outcome">
										{invite === "accepted"
											? "Invitation accepted — you now have access to Blog design."
											: "Invitation declined."}
									</p>
								)
							}
						/>
					)}

					{show("files") && (
						<NotificationRow
							person={LILY_ROSE}
							action={
								<>
									shared files in{" "}
									<Chip
										icon={<Sparkles size={13} />}
										label="Marketing site"
										tone="rose"
									/>
								</>
							}
							when="Friday 1:40 PM"
							ago="4 hours ago"
							extra={
								<div className="mock-nd__files">
									<FileCard
										ext="FIG"
										tone="fig"
										name="Marketing site v4.0.fig"
										size="14 MB"
									/>
									<FileCard
										ext="MP4"
										tone="mp4"
										name="Prototype recording 01.mp4"
										size="14 MB"
									/>
								</div>
							}
						/>
					)}

					{show("all") && (
						<NotificationRow
							person={LANA}
							action="liked your update"
							when="Friday 12:16 PM"
							ago="4 hours ago"
						/>
					)}

					{filter === "jobs" && (
						<p className="mock-nd__empty">No job updates yet.</p>
					)}
				</div>
			</section>
		</div>
	);
}
