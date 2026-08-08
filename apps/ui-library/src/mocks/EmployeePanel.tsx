import { useState } from "react";
import {
	Avatar,
	Badge,
	Button,
	DayTimeline,
	IconButton,
	Menu,
	MenuDivider,
	MenuItem,
} from "@twodb/ui";
import {
	ExternalLink,
	FileText,
	MoreHorizontal,
	Pencil,
	Trash2,
	X,
} from "lucide-react";

const DAY_SEGMENTS = [
	{ label: "Nexora Web", start: 10 * 60, end: 14 * 60 + 15 },
	{ label: "Bluemint App", start: 14 * 60 + 15, end: 18 * 60 + 20 },
	{ label: "Klaro", start: 18 * 60 + 20, end: 20 * 60 + 30 },
	{ label: "FEST", start: 20 * 60 + 30, end: 21 * 60 },
];

const NOTES = [
	{
		id: "n1",
		author: "Anna Kozar",
		scope: "Private",
		date: "Monday, 09 Jan 2026",
		text: "Approved extended PTO request for January.",
	},
	{
		id: "n2",
		author: "Anna Kozar",
		scope: "Public",
		date: "Monday, 21 Nov 2025",
		text: "Completed the advanced 'Inclusive Leadership' corporate certification.",
	},
];

const FILES = [
	{ id: "f1", name: "New_Team_Protocols.pdf", meta: "PDF · 2.6 MB" },
	{ id: "f2", name: "Employee_Guidelines.docx", meta: "DOCX · 115 KB" },
];

const COMP = [
	{
		label: "Pay rate",
		value: "$44/hour",
		from: "From 11/21/2025",
		current: true,
	},
	{
		label: "Pay rate",
		value: "$41/hour",
		from: "From 07/11/2025",
		current: false,
	},
	{
		label: "Billable rate",
		value: "$45",
		from: "From 11/21/2025",
		current: true,
	},
	{
		label: "Billable rate",
		value: "$40",
		from: "From 07/11/2025",
		current: false,
	},
];

export function EmployeePanelMock() {
	const [open, setOpen] = useState(true);

	if (!open) {
		return (
			<div className="mock-emp__reopen">
				<Button variant="secondary" onClick={() => setOpen(true)}>
					Reopen panel
				</Button>
			</div>
		);
	}

	return (
		<div className="mock-emp">
			<aside className="mock-emp__panel" aria-label="Employee profile">
				<header className="mock-emp__bar">
					<h3>Employee profile</h3>
					<div className="mock-emp__bar-actions">
						<IconButton label="Open full page" icon={<ExternalLink />} />
						<IconButton
							label="Close panel"
							icon={<X />}
							onClick={() => setOpen(false)}
						/>
					</div>
				</header>

				<div className="mock-emp__scroll">
					{/* profile */}
					<div className="mock-emp__profile">
						<span className="mock-emp__avatar">
							<Avatar name="Emily Davidson" size="lg" />
							<i className="mock-emp__online" aria-label="Online" />
						</span>
						<div className="mock-emp__who">
							<strong>Emily Davidson</strong>
							<span>Co-Admin, Team Manager</span>
						</div>
						<Button size="sm" variant="ghost">
							<Pencil size={13} aria-hidden="true" />
							Edit Profile
						</Button>
					</div>

					<dl className="mock-emp__info">
						<div>
							<dt>Email address</dt>
							<dd>edavidson@gmail.com</dd>
						</div>
						<div>
							<dt>Phone number</dt>
							<dd className="tw-tnum">+1 (303) 555-0134</dd>
						</div>
						<div>
							<dt>Timezone</dt>
							<dd>(UTC-07:00) Denver</dd>
						</div>
					</dl>

					{/* timeline */}
					<section className="mock-emp__section">
						<DayTimeline
							title="Timeline"
							dateLabel="Today, Apr 05 2026"
							tracking
							segments={DAY_SEGMENTS}
							tickEvery={3}
						/>
					</section>

					{/* notes */}
					<section className="mock-emp__section">
						<h4>Notes</h4>
						{NOTES.map((n) => (
							<div key={n.id} className="mock-emp__note">
								<div className="mock-emp__note-head">
									<strong>{n.author}</strong>
									<Badge
										size="sm"
										tone={n.scope === "Private" ? "neutral" : "go"}
									>
										{n.scope}
									</Badge>
									<Menu
										placement="bottom-end"
										trigger={
											<IconButton
												size="sm"
												label={`Options for note by ${n.author}`}
												icon={<MoreHorizontal />}
											/>
										}
									>
										<MenuItem icon={<Pencil />}>Edit note</MenuItem>
										<MenuDivider />
										<MenuItem icon={<Trash2 />} danger>
											Delete
										</MenuItem>
									</Menu>
								</div>
								<span className="mock-emp__note-date tw-tnum">{n.date}</span>
								<p>{n.text}</p>
							</div>
						))}
					</section>

					{/* files */}
					<section className="mock-emp__section">
						<h4>Files</h4>
						<div className="mock-emp__files">
							{FILES.map((f) => (
								<div key={f.id} className="mock-emp__file">
									<span className="mock-emp__file-icon">
										<FileText size={15} aria-hidden="true" />
									</span>
									<div className="mock-emp__file-meta">
										<strong>{f.name}</strong>
										<span className="tw-tnum">{f.meta}</span>
									</div>
								</div>
							))}
						</div>
					</section>

					{/* compensations */}
					<section className="mock-emp__section">
						<h4>Compensations</h4>
						<div className="mock-emp__comp">
							{COMP.map((c, i) => (
								<div
									key={i}
									className={
										c.current
											? "mock-emp__comp-row"
											: "mock-emp__comp-row mock-emp__comp-row--past"
									}
								>
									<span className="mock-emp__comp-label">{c.label}</span>
									<span className="mock-emp__comp-from tw-tnum">{c.from}</span>
									<strong className="tw-tnum">{c.value}</strong>
								</div>
							))}
						</div>
					</section>
				</div>
			</aside>
		</div>
	);
}
