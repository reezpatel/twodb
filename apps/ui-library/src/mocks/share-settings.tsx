import { Badge, Button } from "@twodb/ui";
import {
	Check,
	ChevronDown,
	ChevronRight,
	Link,
	LockKeyhole,
	Plus,
	Search,
	Users,
	X,
} from "lucide-react";
import "./share-settings";

type AccessTone = "owner" | "person" | "group" | "product";

interface AccessRow {
	name: string;
	sub: string;
	initials?: string;
	permission?: "Owner" | "View" | "Edit";
	tone: AccessTone;
	locked?: boolean;
}

const ACCESS: AccessRow[] = [
	{
		name: "Esther Howard",
		sub: "ESTHER.HOWARD@ACMERSON.COM",
		initials: "AH",
		permission: "Owner",
		tone: "owner",
		locked: true,
	},
	{
		name: "Hector Garcia",
		sub: "HECTOR.GARCIA@ACMERSON.COM",
		initials: "HG",
		permission: "View",
		tone: "person",
	},
	{
		name: "People and Culture",
		sub: "15 MEMBERS",
		permission: "Edit",
		tone: "group",
	},
	{
		name: "Product Team North America",
		sub: "87 MEMBERS",
		permission: "Edit",
		tone: "product",
	},
];

const RESULTS = [
	{
		kind: "GROUPS",
		name: "People and Culture",
		sub: "15 MEMBERS",
		tone: "group",
	},
	{
		kind: "GROUPS",
		name: "Internal Communications",
		sub: "2 MEMBERS",
		tone: "owner",
	},
	{ kind: "GROUPS", name: "Executives", sub: "3 MEMBERS", tone: "owner" },
	{
		kind: "PEOPLE",
		name: "Esther Howard",
		sub: "ESTHER.HOWARD@ACMERSON.COM",
		initials: "AH",
		tone: "owner",
	},
	{
		kind: "PEOPLE",
		name: "Hector Garcia",
		sub: "HECTOR.GARCIA@ACMERSON.COM",
		initials: "HG",
		tone: "person",
	},
] as const;

function PermissionButton({
	value,
	locked,
}: {
	value?: string;
	locked?: boolean;
}) {
	if (locked) return <Badge>Owner</Badge>;
	return (
		<button className="mock-share__permission" type="button">
			{value} <ChevronDown aria-hidden="true" />
		</button>
	);
}

function AccessAvatar({ row }: { row: Pick<AccessRow, "initials" | "tone"> }) {
	return row.initials ? (
		<span
			className={`mock-share__avatar mock-share__avatar--${row.tone}`}
			role="img"
			aria-label={row.initials}
		>
			{row.initials}
		</span>
	) : (
		<span
			className={`mock-share__group-icon mock-share__group-icon--${row.tone}`}
			role="img"
			aria-label="Group"
		>
			<Users aria-hidden="true" />
		</span>
	);
}

function AccessLine({ row }: { row: AccessRow }) {
	return (
		<div
			className={
				row.locked
					? "mock-share__row mock-share__row--locked"
					: "mock-share__row"
			}
		>
			{row.locked ? (
				<span className="mock-share__row-spacer" />
			) : (
				<button
					type="button"
					className="mock-share__remove"
					aria-label={`Remove ${row.name}`}
				>
					<X />
				</button>
			)}
			<AccessAvatar row={row} />
			<span className="mock-share__identity">
				<strong>{row.name}</strong>
				<em>{row.sub}</em>
			</span>
			<PermissionButton value={row.permission} locked={row.locked} />
			{row.locked ? (
				<LockKeyhole className="mock-share__chev" aria-hidden="true" />
			) : (
				<ChevronRight className="mock-share__chev" aria-hidden="true" />
			)}
		</div>
	);
}

function ShareControls({ open }: { open?: boolean }) {
	return (
		<div
			className={
				open
					? "mock-share__controls mock-share__controls--open"
					: "mock-share__controls"
			}
		>
			<label>
				<Search aria-hidden="true" />
				<input
					defaultValue={open ? "pe" : ""}
					placeholder="Search by group name…"
				/>
			</label>
			<button
				className="mock-share__permission"
				type="button"
				aria-label="Default permission"
			>
				View <ChevronDown aria-hidden="true" />
			</button>
			<Button size="sm" variant="secondary">
				<Plus size={14} aria-hidden="true" /> Add
			</Button>
		</div>
	);
}

function ShareDialog({ mode }: { mode: "access" | "search" }) {
	const searchOpen = mode === "search";
	return (
		<section
			className={`mock-share__dialog mock-share__dialog--${mode}`}
			aria-label={`Share Company Offsite 2023 ${mode}`}
		>
			<header className="mock-share__head">
				<div>
					<span className="mock-share__eyebrow">
						<LockKeyhole aria-hidden="true" /> Private list
					</span>
					<h2>Share “Company Offsite 2023”</h2>
					<p>
						This personalization list and its data remain locked to this email
						unless you explicitly invite a person or group.
					</p>
				</div>
			</header>
			<div className="mock-share__content">
				<ShareControls open={searchOpen} />
				<AccessList subdued={searchOpen} />
				{searchOpen ? <SearchResults /> : null}
			</div>
			<footer className="mock-share__foot">
				<button type="button" className="mock-share__copy">
					<Link aria-hidden="true" /> Copy link
				</button>
				<span className="mock-share__foot-note">
					<Check aria-hidden="true" /> Link restricted to invited users
				</span>
				<Button size="sm" variant="secondary">
					Cancel
				</Button>
				<Button size="sm">Share</Button>
			</footer>
		</section>
	);
}

function AccessList({ subdued = false }: { subdued?: boolean }) {
	return (
		<div
			className={
				subdued ? "mock-share__access is-subdued" : "mock-share__access"
			}
		>
			<span className="mock-share__label">People with access</span>
			{ACCESS.map((row) => (
				<AccessLine key={row.name} row={row} />
			))}
		</div>
	);
}

function SearchResults() {
	let current = "";
	return (
		<div
			className="mock-share__results"
			role="listbox"
			aria-label="Invite search results"
		>
			{RESULTS.map((row) => {
				const show = current !== row.kind;
				current = row.kind;
				return (
					<div key={`${row.kind}-${row.name}`}>
						{show ? (
							<span className="mock-share__label">{row.kind}</span>
						) : null}
						<button type="button" className="mock-share__result">
							<AccessAvatar row={row} />
							<span className="mock-share__identity">
								<strong>{row.name}</strong>
								<em>{row.sub}</em>
							</span>
							<Plus aria-hidden="true" />
						</button>
					</div>
				);
			})}
		</div>
	);
}

export function ShareSettingsMock() {
	return (
		<div className="mock-share">
			<div className="mock-share__wash mock-share__wash--a" />
			<div className="mock-share__wash mock-share__wash--b" />
			<div className="mock-share__stage-note mock-share__stage-note--left">
				Access list
			</div>
			<div className="mock-share__stage-note mock-share__stage-note--right">
				Search open
			</div>
			<ShareDialog mode="access" />
			<ShareDialog mode="search" />
		</div>
	);
}
