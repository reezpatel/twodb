/* Share Dialog mock — a project-sharing dialog inspired by the supplied
   reference: a header, a segmented Share/Publish/Export toggle, two
   grouped cards (Direct link and Invite to collaborate), and a footer
   with Copy link / Embed / Done. Cyclorama grammar: hairlines, flat
   cobalt, rose for the AI/secondary actions, IBM Plex Sans cues. */

import { useState } from "react";
import { Avatar, Badge, Button, Input, Segmented } from "@twodb/ui";
import { ChevronDown, Code2, Copy, Link as LinkIcon, X } from "lucide-react";
import "./ShareDialog.css";

/* ---------- data ---------- */

const TABS = [
	{ id: "share", label: "Share" },
	{ id: "publish", label: "Publish" },
	{ id: "export", label: "Export" },
];

interface Member {
	id: string;
	name: string;
	email: string;
	avatar?: string;
	initials?: string;
	hue?: "cobalt" | "rose" | "amber" | "green";
}

const INITIAL_MEMBERS: Member[] = [
	{
		id: "sienna",
		name: "Sienna",
		email: "sienna@untitledui.com",
		initials: "S",
		hue: "rose",
	},
	{
		id: "nikolas",
		name: "Nikolas",
		email: "nikolas@untitledui.com",
		avatar: "https://i.pravatar.cc/96?u=nikolas",
	},
	{
		id: "adrianna",
		name: "Adrianna",
		email: "adrianna@untitledui.com",
		avatar: "https://i.pravatar.cc/96?u=adrianna",
	},
];

const PROJECT_URL = "https://untitledui.com/project/stealth";

/* ---------- pieces ---------- */

function CloseButton() {
	return (
		<button type="button" className="mock-sd__close" aria-label="Close dialog">
			<X size={16} aria-hidden="true" />
		</button>
	);
}

function PermissionButton({ value = "Can view" }: { value?: string }) {
	return (
		<button type="button" className="mock-sd__perm">
			{value}
			<ChevronDown size={14} aria-hidden="true" />
		</button>
	);
}

function AvatarDot({ member }: { member: Member }) {
	if (member.avatar) {
		return (
			<span className="mock-sd__avatar" role="img" aria-label={member.name}>
				<img src={member.avatar} alt="" />
			</span>
		);
	}
	const hue = member.hue ?? "cobalt";
	return (
		<span
			className={`mock-sd__avatar mock-sd__avatar--${hue}`}
			role="img"
			aria-label={member.name}
		>
			<Avatar name={member.name} size="sm" />
		</span>
	);
}

function MemberRow({ member }: { member: Member }) {
	return (
		<div className="mock-sd__member">
			<AvatarDot member={member} />
			<span className="mock-sd__member-email">{member.email}</span>
			<PermissionButton value="Can view" />
		</div>
	);
}

/* ---------- main ---------- */

export function ShareDialogMock() {
	const [tab, setTab] = useState("share");
	const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
	const [invite, setInvite] = useState("");

	const trimmed = invite.trim();

	function handleInvite() {
		if (!trimmed) return;
		// naive "looks like an email" check; real validation happens elsewhere
		const newMember: Member = {
			id: `inv-${Date.now()}`,
			name: trimmed.split("@")[0]!,
			email: trimmed,
			initials: trimmed[0]!.toUpperCase(),
			hue: "cobalt",
		};
		setMembers((cur) => [...cur, newMember]);
		setInvite("");
	}

	return (
		<div className="mock-sd">
			<div className="mock-sd__wash mock-sd__wash--a" aria-hidden="true" />
			<div className="mock-sd__wash mock-sd__wash--b" aria-hidden="true" />

			<section
				className="mock-sd__dialog"
				aria-label="Share project dialog"
				role="dialog"
			>
				<header className="mock-sd__header">
					<div className="mock-sd__head-text">
						<h2>Share project</h2>
						<p>Manage who has access to this project.</p>
					</div>
					<CloseButton />
				</header>

				<div className="mock-sd__tabs">
					<Segmented
						aria-label="Share action"
						items={TABS}
						value={tab}
						onValueChange={setTab}
						full
					/>
				</div>

				<div className="mock-sd__cards">
					{/* Direct link card */}
					<section className="mock-sd__card" aria-label="Direct link">
						<div className="mock-sd__card-head">
							<h3>Direct link</h3>
							<PermissionButton value="Can view" />
						</div>
						<p className="mock-sd__card-sub">
							Anyone with the direct link can view.
						</p>
						<div className="mock-sd__linkrow">
							<span className="mock-sd__linkicon" aria-hidden="true">
								<LinkIcon size={14} />
							</span>
							<span className="mock-sd__linkurl">{PROJECT_URL}</span>
							<Button size="sm" variant="secondary">
								<Copy size={13} aria-hidden="true" />
								Copy
							</Button>
						</div>
					</section>

					{/* Invite to collaborate card */}
					<section className="mock-sd__card" aria-label="Invite to collaborate">
						<div className="mock-sd__card-head">
							<h3>Invite to collaborate</h3>
							<Badge>{members.length} members</Badge>
						</div>
						<p className="mock-sd__card-sub">
							Add team members by username or email.
						</p>

						<div className="mock-sd__inviterow">
							<Input
								placeholder="Email or username"
								value={invite}
								onChange={(e) => setInvite(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleInvite();
								}}
								aria-label="Email or username"
							/>
							<Button size="md" onClick={handleInvite}>
								Invite
							</Button>
						</div>

						<div className="mock-sd__members">
							{members.map((m) => (
								<MemberRow key={m.id} member={m} />
							))}
						</div>
					</section>
				</div>

				<footer className="mock-sd__footer">
					<div className="mock-sd__footer-left">
						<Button size="md" variant="secondary">
							<Copy size={14} aria-hidden="true" />
							Copy link
						</Button>
						<Button size="md" variant="secondary">
							<Code2 size={14} aria-hidden="true" />
							Embed
						</Button>
					</div>
					<Button size="md" className="mock-sd__done">
						Done
					</Button>
				</footer>
			</section>
		</div>
	);
}
