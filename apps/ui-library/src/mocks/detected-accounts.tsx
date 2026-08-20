import { Badge, Button } from "@twodb/ui";
import {
	Building2,
	ChevronDown,
	Cloud,
	Database,
	ExternalLink,
	Fingerprint,
	Link2,
	ShieldCheck,
	UserPlus,
	Video,
} from "lucide-react";
import "./detected-accounts";

type Brand = "salesforce" | "loom" | "google" | "supabase";

const DETECTED_ACCOUNTS: Array<{
	id: string;
	name: string;
	detail: string;
	source: string;
	sourceDetail: string;
	proof: string;
	brand: Brand;
	confidence: string;
	open?: boolean;
}> = [
	{
		id: "salesforce",
		name: "adam.davidson@twoleet.com",
		detail: "No person profile linked yet",
		source: "Salesforce",
		sourceDetail: "Lead owner · Healthcare pipeline",
		proof: "Exact email",
		brand: "salesforce",
		confidence: "99%",
	},
	{
		id: "loom",
		name: "Adam Davidson",
		detail: "adam.davidson@twoleet.com",
		source: "Loom",
		sourceDetail: "Shared recording 2h ago",
		proof: "Email + name",
		brand: "loom",
		confidence: "94%",
		open: true,
	},
	{
		id: "google",
		name: "Adam Davidson",
		detail: "adam.davidson@twoleet.com",
		source: "Google Workspace",
		sourceDetail: "twoleet.com directory",
		proof: "Domain match",
		brand: "google",
		confidence: "91%",
	},
	{
		id: "supabase",
		name: "Adam Davidson",
		detail: "adam.davidson@twoleet.com",
		source: "Supabase",
		sourceDetail: "supa-base project member",
		proof: "Project access",
		brand: "supabase",
		confidence: "88%",
	},
];

const LINKED_ACCOUNTS = [
	{ connection: "Brex", detail: "Oneleet Integration", linked: "Nov 15, 2024" },
	{ connection: "Linear", detail: "Support workspace", linked: "Jan 08, 2025" },
];

function BrandMark({ brand }: { brand: Brand }) {
	const icons = {
		salesforce: <Cloud aria-hidden="true" />,
		loom: <Video aria-hidden="true" />,
		google: <Building2 aria-hidden="true" />,
		supabase: <Database aria-hidden="true" />,
	};

	return (
		<span className={`mock-detect__brandmark mock-detect__brandmark--${brand}`}>
			{icons[brand]}
		</span>
	);
}

function AccountRow({
	account,
}: {
	account: (typeof DETECTED_ACCOUNTS)[number];
}) {
	return (
		<div
			className={account.open ? "mock-detect__row is-open" : "mock-detect__row"}
		>
			<div className="mock-detect__identity">
				<strong>{account.name}</strong>
				<span>{account.detail}</span>
			</div>

			<div className="mock-detect__source">
				<BrandMark brand={account.brand} />
				<div>
					<strong>{account.source}</strong>
					<span>{account.sourceDetail}</span>
				</div>
			</div>

			<div className="mock-detect__evidence">
				<Badge tone="go" size="sm">
					{account.confidence}
				</Badge>
				<span>{account.proof}</span>
			</div>

			<div className="mock-detect__actions">
				<Button variant="ghost" size="sm">
					Ignore
				</Button>
				<div className="mock-detect__split">
					<Button variant="secondary" size="sm">
						<Link2 aria-hidden="true" /> Link to Adam
					</Button>
					<button
						type="button"
						aria-label={`More link actions for ${account.source}`}
					>
						<ChevronDown aria-hidden="true" />
					</button>
					{account.open ? (
						<div className="mock-detect__menu" role="menu">
							<span>Account action</span>
							<button type="button" role="menuitem">
								<Link2 aria-hidden="true" /> Link to another person…
							</button>
							<button type="button" role="menuitem">
								<UserPlus aria-hidden="true" /> Add as new person…
							</button>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}

export function DetectedAccountsMock() {
	return (
		<div
			className="mock-detect"
			aria-label="Automatically detected accounts showcase"
		>
			<section className="mock-detect__profile">
				<div className="mock-detect__avatar">AD</div>
				<div>
					<h2>Adam Davidson</h2>
					<p>Person profile · customer success lead · twoleet.com</p>
				</div>
				<div className="mock-detect__profile-meta">
					<span>Linked accounts</span>
					<strong>2 connected</strong>
				</div>
			</section>

			<section className="mock-detect__panel">
				<header className="mock-detect__head">
					<div>
						<span className="mock-detect__icon">
							<Fingerprint aria-hidden="true" />
						</span>
						<div>
							<h3>Automatically detected accounts</h3>
							<p>
								Review likely integration identities before twodb merges
								history, files, and activity into this profile.
							</p>
						</div>
					</div>
					<Button size="sm">
						<Link2 aria-hidden="true" /> Link all to Adam
					</Button>
				</header>

				<div className="mock-detect__match-strip">
					<div>
						<ShieldCheck aria-hidden="true" />
						<span>
							4 suggestions found from connected tools. Nothing is linked until
							you confirm.
						</span>
					</div>
					<Badge tone="neutral" size="sm">
						Review queue
					</Badge>
				</div>

				<div className="mock-detect__list">
					{DETECTED_ACCOUNTS.map((account) => (
						<AccountRow key={account.id} account={account} />
					))}
				</div>
			</section>

			<section className="mock-detect__linked">
				<div className="mock-detect__linked-head">
					<h3>Already linked</h3>
					<Button variant="secondary" size="sm">
						<ExternalLink aria-hidden="true" /> Export
					</Button>
				</div>
				<div className="mock-detect__table">
					<div className="mock-detect__table-head">
						<span>Connection</span>
						<span>Linked</span>
						<span>Action</span>
					</div>
					{LINKED_ACCOUNTS.map((account) => (
						<div key={account.connection} className="mock-detect__table-row">
							<div>
								<strong>{account.connection}</strong>
								<span>{account.detail}</span>
							</div>
							<time>{account.linked}</time>
							<button type="button">
								<Link2 aria-hidden="true" /> Unlink
							</button>
						</div>
					))}
				</div>
			</section>
		</div>
	);
}
