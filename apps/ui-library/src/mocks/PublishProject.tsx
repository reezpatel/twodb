import { Button, Switch, Avatar } from "@twodb/ui";
import { Calendar, ChevronDown, Plus, Search } from "lucide-react";
import "./PublishProject.css";

interface TeamMember {
	id: string;
	name: string;
	email: string;
	avatarUrl?: string;
	enabled: boolean;
}

const TEAM_MEMBERS: TeamMember[] = [
	{
		id: "1",
		name: "Caitlyn King",
		email: "caitlyn@untitledui.com",
		avatarUrl: "https://i.pravatar.cc/150?u=caitlyn",
		enabled: true,
	},
	{
		id: "2",
		name: "Riley O'Moore",
		email: "riley@untitledui.com",
		avatarUrl: "https://i.pravatar.cc/150?u=riley",
		enabled: true,
	},
];

function TeamMemberRow({ member }: { member: TeamMember }) {
	return (
		<div className="mock-publish__member">
			<Avatar name={member.name} src={member.avatarUrl} size="sm" />
			<div className="mock-publish__member-info">
				<span className="mock-publish__member-name">{member.name}</span>
				<span className="mock-publish__member-email">{member.email}</span>
			</div>
			<button
				className="mock-publish__member-add"
				type="button"
				aria-label={`Add ${member.name}`}
			>
				<Plus size={16} />
			</button>
			<Switch checked={member.enabled} aria-label={`Enable ${member.name}`} />
		</div>
	);
}

function VisibilityToggle({
	value,
	selected,
	label,
}: {
	value: "public" | "team" | "private";
	selected: "public" | "team" | "private";
	label: string;
}) {
	return (
		<button
			type="button"
			className={`mock-publish__visibility ${selected === value ? "is-selected" : ""}`}
		>
			{label}
		</button>
	);
}

export function PublishProjectMock() {
	return (
		<div className="mock-publish">
			<div className="mock-publish__wash mock-publish__wash--a" />
			<div className="mock-publish__wash mock-publish__wash--b" />

			<div className="mock-publish__dialog">
				<div className="mock-publish__header">
					<div>
						<h2 className="mock-publish__title">Publish this project</h2>
						<p className="mock-publish__description">
							Publish now or schedule to publish this project.
						</p>
					</div>
					<button
						className="mock-publish__close"
						type="button"
						aria-label="Close dialog"
					>
						<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
							<path
								d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
							/>
						</svg>
					</button>
				</div>

				<div className="mock-publish__content">
					{/* Visibility Toggle Group */}
					<div className="mock-publish__visibility-group">
						<VisibilityToggle
							value="public"
							selected="team"
							label="Public project"
						/>
						<VisibilityToggle
							value="team"
							selected="team"
							label="Team project"
						/>
						<VisibilityToggle
							value="private"
							selected="team"
							label="Private project"
						/>
					</div>

					{/* Select Team */}
					<div className="mock-publish__section">
						<label className="mock-publish__label">Select team</label>
						<div className="mock-publish__team-select">
							<div className="mock-publish__team-selected">
								<span className="mock-publish__team-icon">🎨</span>
								<span>Lovable</span>
							</div>
							<ChevronDown size={16} />
						</div>
					</div>

					{/* Team Members */}
					<div className="mock-publish__section">
						<label className="mock-publish__label">Team members</label>
						<div className="mock-publish__team-search">
							<div className="mock-publish__search-input">
								<Search size={16} className="mock-publish__search-icon" />
								<input
									type="text"
									placeholder="Search by name, email or group"
									className="mock-publish__input"
								/>
							</div>
							<Button size="sm" variant="secondary">
								Add
							</Button>
						</div>

						<div className="mock-publish__members-list">
							{TEAM_MEMBERS.map((member) => (
								<TeamMemberRow key={member.id} member={member} />
							))}
						</div>

						<div className="mock-publish__option">
							<label className="mock-publish__option-label">
								<span>Allow downloads</span>
								<Switch aria-label="Allow downloads" />
							</label>
						</div>
					</div>
				</div>

				<div className="mock-publish__footer">
					<Button size="sm" variant="ghost">
						Cancel
					</Button>
					<div className="mock-publish__footer-actions">
						<Button size="sm" variant="secondary">
							<Calendar size={16} style={{ marginRight: 6 }} />
							Schedule
						</Button>
						<Button size="sm" variant="primary">
							Publish now
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
