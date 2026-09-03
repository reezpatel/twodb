/* Share Dialog 2 mock — a workspace members dialog inspired by the supplied
   reference. The same panel is shown in both phases (night and day)
   side-by-side so the grammar is read in two lights at once.

   Anatomy: "Members" header, an Allow email domains section with per-domain
   rows (link icon, domain, "Added by X" pill, kebab menu), an Invite to
   collaborate section with avatar+role rows and a "View 2 more" reveal,
   three settings switches, and a footer with Copy link / Embed / Done.

   Cyclorama grammar: hairlines, flat cobalt, rose for the AI's hand,
   dotted dividers between sections, purple is reserved for the Done
   action — the rest of the accent work stays in cobalt. */

import { useState } from "react";
import { Avatar, Badge, Button, Input, Switch } from "@twodb/ui";
import {
	ChevronDown,
	Code2,
	Copy,
	Link as LinkIcon,
	MoreVertical,
	Plus,
	UserPlus,
	X,
} from "lucide-react";
import "./share-dialog2.css";

/* ---------- shared data ---------- */

interface Domain {
	id: string;
	name: string;
	addedBy: string;
	addedByAvatar?: string;
}

const DOMAINS: Domain[] = [
	{
		id: "untitledui",
		name: "untitledui.com",
		addedBy: "Sienna",
		addedByAvatar: "https://i.pravatar.cc/64?u=sienna-domain",
	},
	{
		id: "sisyphus",
		name: "sisyphus.vc",
		addedBy: "Ammar",
		addedByAvatar: "https://i.pravatar.cc/64?u=ammar-domain",
	},
];

type Permission = "Can view" | "Admin";

interface Member {
	id: string;
	email: string;
	avatar: string;
	permission: Permission;
}

const VISIBLE_MEMBERS: Member[] = [
	{
		id: "caitlyn",
		email: "caitlyn@untitledui.com",
		avatar: "https://i.pravatar.cc/96?u=caitlyn",
		permission: "Can view",
	},
	{
		id: "lily-rose",
		email: "lily-rose@untitledui.com",
		avatar: "https://i.pravatar.cc/96?u=lily-rose",
		permission: "Admin",
	},
	{
		id: "nikolas",
		email: "nikolas@untitledui.com",
		avatar: "https://i.pravatar.cc/96?u=nikolas-2",
		permission: "Can view",
	},
	{
		id: "adriana",
		email: "adriana@untitledui.com",
		avatar: "https://i.pravatar.cc/96?u=adriana-2",
		permission: "Can view",
	},
];

const HIDDEN_COUNT = 2;

interface Setting {
	id: string;
	label: string;
	defaultOn: boolean;
}

const SETTINGS: Setting[] = [
	{
		id: "show-profile",
		label: "Show this workspace on my profile",
		defaultOn: true,
	},
	{
		id: "members-invite",
		label: "Allow team members to invite others",
		defaultOn: true,
	},
	{
		id: "export-data",
		label: "Allow visitors to export or duplicate data",
		defaultOn: false,
	},
];

/* ---------- small pieces ---------- */

function CloseButton() {
	return (
		<button type="button" className="mock-sd2__close" aria-label="Close dialog">
			<X size={16} aria-hidden="true" />
		</button>
	);
}

function PermissionButton({ value }: { value: Permission }) {
	return (
		<button type="button" className="mock-sd2__perm">
			{value}
			<ChevronDown size={14} aria-hidden="true" />
		</button>
	);
}

function AddedByPill({ name, avatar }: { name: string; avatar?: string }) {
	return (
		<span className="mock-sd2__addedby">
			<span className="mock-sd2__addedby-avatar" role="img" aria-label={name}>
				{avatar ? (
					<img src={avatar} alt="" />
				) : (
					<Avatar name={name} size="sm" />
				)}
			</span>
			Added by {name}
		</span>
	);
}

function DomainRow({ domain }: { domain: Domain }) {
	return (
		<div className="mock-sd2__domain">
			<span className="mock-sd2__domain-link" aria-hidden="true">
				<LinkIcon size={14} />
			</span>
			<span className="mock-sd2__domain-name">{domain.name}</span>
			<AddedByPill name={domain.addedBy} avatar={domain.addedByAvatar} />
			<button
				type="button"
				className="mock-sd2__kebab"
				aria-label={`Domain options for ${domain.name}`}
			>
				<MoreVertical size={16} aria-hidden="true" />
			</button>
		</div>
	);
}

function MemberRow({ member }: { member: Member }) {
	return (
		<div className="mock-sd2__member">
			<span
				className="mock-sd2__member-avatar"
				role="img"
				aria-label={member.email}
			>
				<img src={member.avatar} alt="" />
			</span>
			<span className="mock-sd2__member-email">{member.email}</span>
			<PermissionButton value={member.permission} />
		</div>
	);
}

function SettingRow({
	setting,
	value,
	onChange,
}: {
	setting: Setting;
	value: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<div className="mock-sd2__setting">
			<label
				className="mock-sd2__setting-label"
				htmlFor={`setting-${setting.id}`}
			>
				{setting.label}
			</label>
			<Switch
				id={`setting-${setting.id}`}
				checked={value}
				onChange={(e) => onChange(e.currentTarget.checked)}
				aria-label={setting.label}
			/>
		</div>
	);
}

/* ---------- the panel (used in both phases) ---------- */

function MembersPanel({
	invite,
	onInviteChange,
	expanded,
	onToggleExpanded,
	settings,
	onSettingChange,
}: {
	invite: string;
	onInviteChange: (v: string) => void;
	expanded: boolean;
	onToggleExpanded: () => void;
	settings: Record<string, boolean>;
	onSettingChange: (id: string, v: boolean) => void;
}) {
	const visible = expanded
		? VISIBLE_MEMBERS
		: VISIBLE_MEMBERS.slice(0, VISIBLE_MEMBERS.length - HIDDEN_COUNT);

	return (
		<section
			className="mock-sd2__dialog"
			aria-label="Members dialog"
			role="dialog"
		>
			<header className="mock-sd2__header">
				<div className="mock-sd2__head-text">
					<h2>Members</h2>
					<p>Manage who has access to this workspace.</p>
				</div>
				<CloseButton />
			</header>

			{/* Allow email domains */}
			<section className="mock-sd2__section" aria-label="Allow email domains">
				<div className="mock-sd2__section-head">
					<h3>Allow email domains</h3>
					<Button size="sm" variant="secondary">
						<Plus size={13} aria-hidden="true" />
						Domain
					</Button>
				</div>
				<p className="mock-sd2__section-sub">
					Email addresses at these domains are allowed.
				</p>
				<div className="mock-sd2__domains">
					{DOMAINS.map((d) => (
						<DomainRow key={d.id} domain={d} />
					))}
				</div>
			</section>

			<div className="mock-sd2__divider" role="separator" aria-hidden="true" />

			{/* Invite to collaborate */}
			<section className="mock-sd2__section" aria-label="Invite to collaborate">
				<div className="mock-sd2__section-head">
					<h3>Invite to collaborate</h3>
					<Badge>{VISIBLE_MEMBERS.length + HIDDEN_COUNT} members</Badge>
				</div>
				<p className="mock-sd2__section-sub">
					Add team members by username or email.
				</p>

				<div className="mock-sd2__inviterow">
					<Input
						placeholder="Email or username"
						value={invite}
						onChange={(e) => onInviteChange(e.target.value)}
						aria-label="Email or username"
					/>
					<Button size="md">
						<UserPlus size={14} aria-hidden="true" />
						Send invite
					</Button>
				</div>

				<div className="mock-sd2__members">
					{visible.map((m) => (
						<MemberRow key={m.id} member={m} />
					))}
				</div>

				{!expanded && (
					<div className="mock-sd2__reveal">
						<Button size="sm" variant="secondary" onClick={onToggleExpanded}>
							View {HIDDEN_COUNT} more
						</Button>
					</div>
				)}
			</section>

			<div className="mock-sd2__divider" role="separator" aria-hidden="true" />

			{/* Settings switches */}
			<section className="mock-sd2__settings" aria-label="Workspace settings">
				{SETTINGS.map((s) => (
					<SettingRow
						key={s.id}
						setting={s}
						value={settings[s.id] ?? s.defaultOn}
						onChange={(v) => onSettingChange(s.id, v)}
					/>
				))}
			</section>

			<footer className="mock-sd2__footer">
				<div className="mock-sd2__footer-left">
					<Button size="md" variant="secondary">
						<Copy size={14} aria-hidden="true" />
						Copy link
					</Button>
					<Button size="md" variant="secondary">
						<Code2 size={14} aria-hidden="true" />
						Embed
					</Button>
				</div>
				<Button size="md" className="mock-sd2__done">
					Done
				</Button>
			</footer>
		</section>
	);
}

/* ---------- main ---------- */

export function ShareDialog2Mock() {
	const [invite, setInvite] = useState("");
	const [expanded, setExpanded] = useState(false);

	/* independent settings per phase so flipping the panel doesn't
	   couple the two */
	const [settingsDay, setSettingsDay] = useState<Record<string, boolean>>(() =>
		Object.fromEntries(SETTINGS.map((s) => [s.id, s.defaultOn])),
	);
	const [settingsNight, setSettingsNight] = useState<Record<string, boolean>>(
		() => Object.fromEntries(SETTINGS.map((s) => [s.id, s.defaultOn])),
	);

	return (
		<div className="mock-sd2" aria-label="Share dialog 2 — both phases">
			<div className="mock-sd2__stage">
				<div className="mock-sd2__stage-note mock-sd2__stage-note--left">
					Night
				</div>
				<div className="mock-sd2__stage-note mock-sd2__stage-note--right">
					Day
				</div>

				{/* Night panel — own phase so the toggle on the canvas
				    doesn't switch it. */}
				<div className="mock-sd2__panel" data-phase="night">
					<MembersPanel
						invite={invite}
						onInviteChange={setInvite}
						expanded={expanded}
						onToggleExpanded={() => setExpanded((v) => !v)}
						settings={settingsNight}
						onSettingChange={(id, v) =>
							setSettingsNight((cur) => ({ ...cur, [id]: v }))
						}
					/>
				</div>

				{/* Day panel — inherits phase from the canvas root. */}
				<div className="mock-sd2__panel">
					<MembersPanel
						invite={invite}
						onInviteChange={setInvite}
						expanded={expanded}
						onToggleExpanded={() => setExpanded((v) => !v)}
						settings={settingsDay}
						onSettingChange={(id, v) =>
							setSettingsDay((cur) => ({ ...cur, [id]: v }))
						}
					/>
				</div>
			</div>
		</div>
	);
}
