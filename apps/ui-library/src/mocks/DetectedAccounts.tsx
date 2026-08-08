import { Badge, Button } from "@twodb/ui";
import {
	ChevronDown,
	ExternalLink,
	Fingerprint,
	Link2,
	ShieldCheck,
	UserPlus,
} from "lucide-react";
import "./DetectedAccounts.css";

const DETECTED_ACCOUNTS = [
	{
		id: "salesforce",
		name: "adam.davidson@twoleet.com",
		detail: "Matched by exact email",
		source: "Salesforce",
		sourceDetail: "Lead owner · Healthcare pipeline",
		brand: "salesforce",
		confidence: "99%",
	},
	{
		id: "loom",
		name: "Adam Davidson",
		detail: "adam.davidson@twoleet.com",
		source: "Loom",
		sourceDetail: "Last recording shared 2h ago",
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
		brand: "google",
		confidence: "91%",
	},
	{
		id: "supabase",
		name: "Adam Davidson",
		detail: "adam.davidson@twoleet.com",
		source: "Supabase",
		sourceDetail: "supa-base project member",
		brand: "supabase",
		confidence: "88%",
	},
];

const LINKED_ACCOUNTS = [
	{ connection: "Brex", detail: "Oneleet Integration", linked: "Nov 15, 2024" },
	{ connection: "Linear", detail: "Support workspace", linked: "Jan 08, 2025" },
];

function BrandMark({ brand }: { brand: string }) {
	return (
		<span
			className={`mock-detect__brandmark mock-detect__brandmark--${brand}`}
			aria-hidden="true"
		/>
	);
}

function AccountRow({
	account,
}: {
	account: (typeof DETECTED_ACCOUNTS)[number];
}) {
	return (
		<div className="mock-detect__row">
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
			<Badge tone="go" size="sm">
				{account.confidence} match
			</Badge>
			<div className="mock-detect__actions">
				<Button variant="ghost" size="sm">
					Ignore
				</Button>
				<div className="mock-detect__split">
					<Button size="sm">
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
					<p>Person profile · customer success lead</p>
				</div>
				<div className="mock-detect__profile-meta">
					<span>Accounts</span>
					<strong>2 linked</strong>
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
								twodb found 4 accounts from connected integrations that are
								probably this same person.
							</p>
						</div>
					</div>
					<Button variant="ghost" size="sm">
						<Link2 aria-hidden="true" /> Link all to Adam
					</Button>
				</header>

				<div className="mock-detect__match-strip">
					<div>
						<ShieldCheck aria-hidden="true" />
						<span>Exact email and domain matches are prioritized.</span>
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
