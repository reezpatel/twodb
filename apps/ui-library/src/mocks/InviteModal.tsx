/* Invite Modal mock — a dashboard sharing view inspired by the supplied
   reference. Two panels share one washed day stage:

   Left — "Your dashboard is live" with a copy-link row, an SMS send
   row, a centered QR code, and the App Store / Google Play buttons.

   Right — "Invite team members" with an email input + Send invite,
   a list of pending and active members (mixed avatar styles,
   Pending badges, Can edit / Admin roles), and an Enterprise license
   panel with a seat gauge and an Upgrade link.

   Cyclorama grammar: hairlines, flat cobalt, purple Send invite,
   IBM Plex Sans cues. The QR code sits in a white mount with corner marks. */

import { useState } from "react";
import {
	Avatar,
	Badge,
	Button,
	Input,
	Progress,
	QRCode,
	Select,
} from "@twodb/ui";
import { Box, ChevronDown, Copy, Send, X } from "lucide-react";
import "./InviteModal.css";

/* ---------- data ---------- */

type Permission = "Can edit" | "Admin";

interface Member {
	id: string;
	email: string;
	name?: string;
	/** Initial avatar — used when no photo src. */
	initial?: string;
	avatar?: string;
	pending?: boolean;
	permission: Permission;
}

const MEMBERS: Member[] = [
	{
		id: "emma",
		email: "emma@untitledui.com",
		initial: "E",
		pending: true,
		permission: "Can edit",
	},
	{
		id: "caitlyn",
		email: "caitlyn@untitledui.com",
		initial: "C",
		pending: true,
		permission: "Can edit",
	},
	{
		id: "liamay",
		email: "liamay@untitledui.com",
		initial: "L",
		permission: "Can edit",
	},
	{
		id: "frankie",
		email: "frankie@untitledui.com",
		initial: "F",
		permission: "Admin",
	},
	{
		id: "mathilde",
		email: "mathilde@untitledui.com",
		name: "Mathilde Lewis",
		avatar: "https://i.pravatar.cc/96?u=mathilde",
		permission: "Admin",
	},
	{
		id: "sienna",
		email: "sienna@untitledui.com",
		name: "Sienna Hewitt",
		avatar: "https://i.pravatar.cc/96?u=sienna-invite",
		permission: "Admin",
	},
];

const TOTAL_SEATS = 5;
const USED_SEATS = 4;
const DASHBOARD_URL = "dashboard.untitledui.com";

const COUNTRY_OPTIONS = [
	{ value: "us", label: "US" },
	{ value: "ca", label: "CA" },
	{ value: "uk", label: "UK" },
	{ value: "in", label: "IN" },
	{ value: "de", label: "DE" },
];

/* ---------- left: dashboard live ---------- */

function DashboardLive() {
	return (
		<section className="mock-im__live" aria-label="Your dashboard is live">
			<header className="mock-im__live-head">
				<h3>Your dashboard is live</h3>
				<p>Future change will be published automatically.</p>
			</header>

			<div className="mock-im__live-block">
				<span className="mock-im__live-label">Share link</span>
				<div className="mock-im__linkrow">
					<span className="mock-im__linkurl">{DASHBOARD_URL}</span>
					<button
						type="button"
						className="mock-im__copybtn"
						aria-label="Copy link"
					>
						<Copy size={14} aria-hidden="true" />
					</button>
				</div>
			</div>

			<div className="mock-im__live-block">
				<h3>Get the mobile app</h3>
				<p>Access your dashboard on the go with our app.</p>

				<div className="mock-im__sms">
					<span className="mock-im__live-label">Send link via SMS</span>
					<div className="mock-im__sms-row">
						<div className="mock-im__sms-country">
							<Select
								aria-label="Country code"
								defaultValue="us"
								options={COUNTRY_OPTIONS}
							/>
						</div>
						<Input placeholder="+1 (555) 000-0000" aria-label="Phone number" />
						<button
							type="button"
							className="mock-im__sms-send"
							aria-label="Send SMS"
						>
							<Send size={14} aria-hidden="true" />
						</button>
					</div>
				</div>

				<div className="mock-im__scan">
					<span className="mock-im__scan-divider" aria-hidden="true" />
					<span className="mock-im__scan-label">OR scan to open</span>
					<span className="mock-im__scan-divider" aria-hidden="true" />
				</div>

				<div className="mock-im__qrwrap">
					<span
						className="mock-im__qr-corner mock-im__qr-corner--tl"
						aria-hidden="true"
					/>
					<span
						className="mock-im__qr-corner mock-im__qr-corner--tr"
						aria-hidden="true"
					/>
					<span
						className="mock-im__qr-corner mock-im__qr-corner--bl"
						aria-hidden="true"
					/>
					<span
						className="mock-im__qr-corner mock-im__qr-corner--br"
						aria-hidden="true"
					/>
					<div className="mock-im__qr">
						<QRCode
							value={`https://${DASHBOARD_URL}`}
							size={164}
							label="Scan to open the dashboard"
						/>
					</div>
				</div>

				<div className="mock-im__stores">
					<StoreBadge variant="play" />
					<StoreBadge variant="app" />
				</div>
			</div>
		</section>
	);
}

function StoreBadge({ variant }: { variant: "play" | "app" }) {
	if (variant === "play") {
		return (
			<span className="mock-im__store" aria-label="Get it on Google Play">
				<svg
					className="mock-im__store-icon"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="currentColor"
					aria-hidden="true"
				>
					<path d="M3.609 1.814 13.792 12 3.609 22.186a1.027 1.027 0 0 1-.609-.92V2.734a1.027 1.027 0 0 1 .609-.92Zm10.89 10.893 2.302 2.302-10.937 6.333 8.635-8.635Zm3.92-1.575 2.534 1.467c.62.358.62 1.253 0 1.611l-2.534 1.467-2.667-2.667 2.667-2.667v-.211ZM5.864 2.658 16.801 8.99l-2.302 2.302-8.635-8.634Z" />
				</svg>
				<span className="mock-im__store-text">
					<small>GET IT ON</small>
					<strong>Google Play</strong>
				</span>
			</span>
		);
	}
	return (
		<span className="mock-im__store" aria-label="Download on the App Store">
			<svg
				className="mock-im__store-icon"
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
			>
				<path d="M17.564 12.65c-.024-2.7 2.205-3.998 2.306-4.062-1.255-1.836-3.213-2.087-3.91-2.117-1.665-.169-3.247.98-4.094.98-.85 0-2.146-.957-3.527-.93-1.815.025-3.49 1.055-4.42 2.677-1.886 3.27-.482 8.108 1.357 10.768.9 1.302 1.973 2.76 3.38 2.708 1.358-.054 1.872-.884 3.51-.884 1.638 0 2.103.884 3.532.852 1.456-.025 2.38-1.323 3.276-2.633 1.034-1.508 1.46-2.967 1.484-3.045-.032-.013-2.847-1.094-2.874-4.314ZM14.946 4.79c.736-.892 1.234-2.13 1.097-3.365-1.06.045-2.34.708-3.1 1.6-.683.79-1.282 2.05-1.122 3.265 1.183.092 2.388-.604 3.125-1.5Z" />
			</svg>
			<span className="mock-im__store-text">
				<small>Download on the</small>
				<strong>App Store</strong>
			</span>
		</span>
	);
}

/* ---------- right: invite team members ---------- */

function MemberAvatar({ member }: { member: Member }) {
	if (member.avatar) {
		return (
			<span
				className="mock-im__member-photo"
				role="img"
				aria-label={member.name ?? member.email}
			>
				<img src={member.avatar} alt="" />
			</span>
		);
	}
	const letter = member.initial ?? member.email[0]!.toUpperCase();
	return (
		<span
			className="mock-im__member-initial"
			role="img"
			aria-label={member.name ?? member.email}
		>
			<Avatar name={letter} size="sm" />
		</span>
	);
}

function MemberRow({ member }: { member: Member }) {
	return (
		<div className="mock-im__member">
			<MemberAvatar member={member} />
			<span className="mock-im__member-meta">
				{member.name && <strong>{member.name}</strong>}
				<span className="mock-im__member-email">{member.email}</span>
			</span>
			{member.pending ? <Badge tone="warning">Pending</Badge> : null}
			<button type="button" className="mock-im__perm">
				{member.permission}
				<ChevronDown size={14} aria-hidden="true" />
			</button>
		</div>
	);
}

function InvitePanel() {
	const [email, setEmail] = useState("");
	return (
		<section className="mock-im__invite" aria-label="Invite team members">
			<header className="mock-im__invite-head">
				<div className="mock-im__invite-head-text">
					<h3>Invite team members</h3>
					<p>
						We&rsquo;ll email them instructions and a link to create an account.
					</p>
				</div>
				<button
					type="button"
					className="mock-im__close"
					aria-label="Close invite panel"
				>
					<X size={16} aria-hidden="true" />
				</button>
			</header>

			<div className="mock-im__invite-form">
				<div className="mock-im__invite-field">
					<label className="mock-im__live-label">Invite email</label>
					<Input
						placeholder="Enter email address"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						aria-label="Email address"
					/>
				</div>
				<Button size="md" className="mock-im__send">
					Send invite
				</Button>
			</div>

			<div className="mock-im__members">
				{MEMBERS.map((m) => (
					<MemberRow key={m.id} member={m} />
				))}
			</div>

			<aside className="mock-im__enterprise" aria-label="Enterprise license">
				<span className="mock-im__enterprise-icon" aria-hidden="true">
					<Box size={18} />
				</span>
				<div className="mock-im__enterprise-text">
					<strong>Enterprise license</strong>
					<span>Upgrade your account to add more users.</span>
				</div>
				<div className="mock-im__enterprise-meter">
					<Progress
						value={USED_SEATS}
						max={TOTAL_SEATS}
						tone="purple"
						aria-label={`${USED_SEATS} of ${TOTAL_SEATS} seats used`}
					/>
					<span className="mock-im__enterprise-count tw-tnum">
						{USED_SEATS}/{TOTAL_SEATS} seats
					</span>
				</div>
				<a className="mock-im__upgrade" href="#upgrade">
					Upgrade
				</a>
			</aside>
		</section>
	);
}

/* ---------- main ---------- */

export function InviteModalMock() {
	return (
		<div className="mock-im">
			<div className="mock-im__wrap">
				<DashboardLive />
				<InvitePanel />
			</div>
		</div>
	);
}
