import { useState } from "react";
import { Avatar, Button } from "@twodb/ui";
import {
	Check,
	ChevronDown,
	Eye,
	GitBranch,
	GripVertical,
	Link2,
	MoreHorizontal,
	Plus,
} from "lucide-react";
import "./ticket-creator.css";

/* ---------- data ---------- */

interface Assignee {
	name: string;
	initials: string;
}

interface Stakeholder {
	name: string;
	initials: string;
}

interface Subitem {
	id: string;
	title: string;
	assignee?: Assignee;
	dueDate: string;
	status: "todo" | "in-progress" | "done";
}

const ASSIGNEES: Assignee[] = [{ name: "Marco Alves", initials: "MA" }];

const STAKEHOLDERS: Stakeholder[] = [
	{ name: "Homura", initials: "HO" },
	{ name: "Darika Samak", initials: "DS" },
];

const TAGS = ["#design", "#dashboard", "#developer"];

const SUBITEMS: Subitem[] = [
	{
		id: "sub1",
		title: "First cut wireframe",
		assignee: { name: "Marco Alves", initials: "MA" },
		dueDate: "20 June 2023",
		status: "in-progress",
	},
];

/* ---------- components ---------- */

function PersonChip({ name, initials }: { name: string; initials: string }) {
	return (
		<span className="mock-ticket__person" title={name}>
			<span className="mock-ticket__person-avatar">{initials}</span>
			{name}
		</span>
	);
}

function AddButton({ label }: { label: string }) {
	return (
		<button
			type="button"
			className="mock-ticket__add-btn"
			aria-label={label}
			title={label}
		>
			<Plus aria-hidden="true" />
		</button>
	);
}

function StatusBadge({ label }: { label: string }) {
	return (
		<button type="button" className="mock-ticket__status" aria-label="Status">
			<span className="mock-ticket__status-icon">
				<Check aria-hidden="true" />
			</span>
			{label}
			<ChevronDown aria-hidden="true" />
		</button>
	);
}

function SubitemRow({ item }: { item: Subitem }) {
	return (
		<div className="mock-ticket__subitem">
			<span className="mock-ticket__subitem-title">{item.title}</span>
			{item.assignee && <Avatar name={item.assignee.name} size="sm" />}
			<span className="mock-ticket__subitem-date">
				{item.dueDate}
				<ChevronDown aria-hidden="true" />
			</span>
			<span
				className="mock-ticket__subitem-status"
				title={item.status}
				aria-label={item.status}
			>
				{item.status === "in-progress" && <Check aria-hidden="true" />}
			</span>
			<button
				type="button"
				className="mock-ticket__subitem-more"
				aria-label="More actions"
			>
				<MoreHorizontal aria-hidden="true" />
			</button>
		</div>
	);
}

function TicketDialog() {
	const [title, setTitle] = useState("Developer Dashboard");

	return (
		<section
			className="mock-ticket__dialog"
			aria-label="Create issue dialog"
			role="dialog"
		>
			{/* Header */}
			<header className="mock-ticket__head">
				<h2>Create issue</h2>
				<div className="mock-ticket__headtools">
					<button
						type="button"
						className="mock-ticket__headtool"
						aria-label="Preview"
					>
						<Eye aria-hidden="true" />
					</button>
					<button
						type="button"
						className="mock-ticket__headtool"
						aria-label="Branch"
					>
						<GitBranch aria-hidden="true" />
					</button>
					<button
						type="button"
						className="mock-ticket__headtool"
						aria-label="Copy link"
					>
						<Link2 aria-hidden="true" />
					</button>
					<button
						type="button"
						className="mock-ticket__headtool"
						aria-label="More options"
					>
						<MoreHorizontal aria-hidden="true" />
					</button>
				</div>
			</header>

			{/* Content */}
			<div className="mock-ticket__content">
				{/* Title row */}
				<div className="mock-ticket__title-row">
					<input
						type="text"
						className="mock-ticket__title-input"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Issue title"
						aria-label="Issue title"
					/>
					<button
						type="button"
						className="mock-ticket__add-assignee"
						aria-label="Add assignee"
					>
						Add assignee
					</button>
				</div>

				{/* Fields */}
				<div className="mock-ticket__fields">
					{/* Assignee */}
					<div className="mock-ticket__field">
						<span className="mock-ticket__label">Assignee</span>
						<div className="mock-ticket__value">
							{ASSIGNEES.map((a) => (
								<PersonChip key={a.name} name={a.name} initials={a.initials} />
							))}
							<AddButton label="Add assignee" />
						</div>
					</div>

					{/* Stakeholders */}
					<div className="mock-ticket__field">
						<span className="mock-ticket__label">Stakeholders</span>
						<div className="mock-ticket__value">
							{STAKEHOLDERS.map((s) => (
								<PersonChip key={s.name} name={s.name} initials={s.initials} />
							))}
							<AddButton label="Add stakeholder" />
						</div>
					</div>

					{/* Due date */}
					<div className="mock-ticket__field">
						<span className="mock-ticket__label">Due date and quarter</span>
						<div className="mock-ticket__value">
							<button
								type="button"
								className="mock-ticket__date-btn"
								aria-label="Select due date"
							>
								20 June 2023
								<ChevronDown aria-hidden="true" />
							</button>
						</div>
					</div>

					{/* Status */}
					<div className="mock-ticket__field">
						<span className="mock-ticket__label">Status</span>
						<div className="mock-ticket__value">
							<StatusBadge label="Just started" />
						</div>
					</div>

					{/* Projects */}
					<div className="mock-ticket__field">
						<span className="mock-ticket__label">Projects</span>
						<div className="mock-ticket__value">
							<span className="mock-ticket__project">
								<span className="mock-ticket__project-dot" />
								Dashboard
							</span>
						</div>
					</div>

					{/* Tags */}
					<div className="mock-ticket__field">
						<span className="mock-ticket__label">Tags</span>
						<div className="mock-ticket__value">
							{TAGS.map((tag) => (
								<span key={tag} className="mock-ticket__tag">
									{tag}
								</span>
							))}
						</div>
					</div>

					{/* Work type */}
					<div className="mock-ticket__field">
						<span className="mock-ticket__label">Work type</span>
						<div className="mock-ticket__value">
							<button
								type="button"
								className="mock-ticket__worktype"
								aria-label="Select work type"
							>
								New feature
								<ChevronDown aria-hidden="true" />
							</button>
						</div>
					</div>
				</div>

				{/* Description */}
				<div className="mock-ticket__desc-section">
					<span className="mock-ticket__desc-label">Description</span>
					<div className="mock-ticket__desc-box">
						<strong>Code Repository Integration:</strong> Integration with
						popular version control systems like Git or GitHub allows developers
						to view and manage their source code, track changes, and collaborate
						with other team members.
						<span className="mock-ticket__desc-resize">
							<GripVertical aria-hidden="true" />
						</span>
					</div>
				</div>

				{/* Subitems */}
				<div className="mock-ticket__subitems-section">
					<div className="mock-ticket__subitems-head">
						<span className="mock-ticket__subitems-label">
							Subitems
							<span className="mock-ticket__subitems-count">01</span>
						</span>
						<button
							type="button"
							className="mock-ticket__subitems-add"
							aria-label="Add subitem"
						>
							<Plus aria-hidden="true" />
							Add
						</button>
					</div>
					{SUBITEMS.map((item) => (
						<SubitemRow key={item.id} item={item} />
					))}
				</div>
			</div>

			{/* Footer */}
			<footer className="mock-ticket__foot">
				<Button variant="secondary">Cancel</Button>
				<Button>Create issue</Button>
			</footer>
		</section>
	);
}

export function TicketCreatorMock() {
	return (
		<div className="mock-ticket">
			<div className="mock-ticket__wash mock-ticket__wash--a" />
			<div className="mock-ticket__wash mock-ticket__wash--b" />
			<TicketDialog />
		</div>
	);
}
