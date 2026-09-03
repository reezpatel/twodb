import { useState } from "react";
import {
	Avatar,
	Badge,
	Button,
	Checkbox,
	IconButton,
	SearchInput,
	Select,
	Tabs,
} from "@twodb/ui";
import {
	Bell,
	BookOpen,
	CalendarDays,
	Check,
	ChevronRight,
	Download,
	Folder,
	Home,
	LayoutGrid,
	Lock,
	Palette,
	Settings,
	Share2,
	Sparkles,
	Archive,
} from "lucide-react";
import "./plans-billing.css";

/* ---------- Sidebar Data ---------- */

const NAV_ITEMS = [
	{ id: "home", label: "Home", icon: Home },
	{ id: "all-projects", label: "All projects", icon: LayoutGrid },
	{ id: "private", label: "Private projects", icon: Lock },
	{ id: "archived", label: "Archived projects", icon: Archive },
	{ id: "shared", label: "Shared with me", icon: Share2 },
	{ id: "events", label: "Events", icon: CalendarDays },
	{ id: "design", label: "Design", icon: Palette },
	{ id: "notifications", label: "Notifications", icon: Bell },
	{ id: "settings", label: "Settings", icon: Settings, active: true },
];

const FOLDERS = [
	{ id: "olivia", label: "Olivia's files" },
	{ id: "sophie", label: "Sophie's files" },
	{ id: "dashboard-ui", label: "Dashboard UI" },
	{ id: "dribbble", label: "Dribbble" },
	{ id: "websites", label: "Websites" },
	{ id: "mobile-apps", label: "Mobile apps" },
];

/* ---------- Plan Features ---------- */

const FREE_FEATURES = [
	"Access to all basic features",
	"Basic reporting and analytics",
	"Up to 10 individual users",
	"20GB individual data each user",
	"Basic chat and email support",
];

const PRO_BUSINESS_FEATURES = [
	"200+ integrations",
	"Advanced reporting and analytics",
	"Up to 20 individual users",
	"40GB individual data each user",
	"Priority chat and email support",
];

const PRO_ENTERPRISE_FEATURES = [
	"Advanced custom fields",
	"Audit log and data history",
	"Unlimited individual users",
	"Unlimited individual data",
	"Personalised+priority service",
];

/* ---------- Invoice Data ---------- */

interface Invoice {
	id: string;
	number: string;
	date: string;
	plan: string;
	amount: string;
}

const INVOICES: Invoice[] = [
	{
		id: "1",
		number: "Invoice 0012",
		date: "12 Apr 2026",
		plan: "Basic plan",
		amount: "USD $0.00",
	},
	{
		id: "2",
		number: "Invoice 0011",
		date: "12 Mar 2026",
		plan: "Basic plan",
		amount: "USD $0.00",
	},
	{
		id: "3",
		number: "Invoice 0010",
		date: "12 Feb 2026",
		plan: "Basic plan",
		amount: "USD $0.00",
	},
	{
		id: "4",
		number: "Invoice 0009",
		date: "12 Jan 2026",
		plan: "Basic plan",
		amount: "USD $0.00",
	},
	{
		id: "5",
		number: "Invoice 0008",
		date: "12 Dec 2026",
		plan: "Basic plan",
		amount: "USD $0.00",
	},
	{
		id: "6",
		number: "Invoice 0007",
		date: "12 Nov 2026",
		plan: "Basic plan",
		amount: "USD $0.00",
	},
	{
		id: "7",
		number: "Invoice 0006",
		date: "12 Oct 2026",
		plan: "Basic plan",
		amount: "USD $0.00",
	},
	{
		id: "8",
		number: "Invoice 0005",
		date: "12 Sep 2024",
		plan: "Basic plan",
		amount: "USD $0.00",
	},
];

/* ---------- Plan Card Component ---------- */

interface PlanCardProps {
	name: string;
	price: string;
	features: string[];
	isCurrent?: boolean;
}

function PlanCard({ name, price, features, isCurrent }: PlanCardProps) {
	return (
		<div
			className={`mock-pb__plan ${isCurrent ? "mock-pb__plan--current" : ""}`}
		>
			<div className="mock-pb__plan-header">
				<div className="mock-pb__plan-icon">
					<span className="mock-pb__slashes">//</span>
				</div>
				<div className="mock-pb__plan-title">
					<h4>{name}</h4>
				</div>
				<span className="mock-pb__plan-price">{price}</span>
			</div>
			<ul className="mock-pb__plan-features">
				{features.map((feature, idx) => (
					<li key={idx}>
						<Check size={14} aria-hidden="true" />
						<span>{feature}</span>
					</li>
				))}
			</ul>
			<Button
				variant={isCurrent ? "ghost" : "secondary"}
				className="mock-pb__plan-btn"
			>
				{isCurrent ? "Current plan" : "Upgrade now"}
			</Button>
		</div>
	);
}

/* ---------- Main Component ---------- */

export function PlansBillingMock() {
	const [navItem, setNavItem] = useState("settings");
	const [foldersExpanded, setFoldersExpanded] = useState(true);
	const [invoiceTab, setInvoiceTab] = useState("all");
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<Set<string>>(new Set());

	const toggle = (id: string) =>
		setSelected((s) => {
			const n = new Set(s);
			if (n.has(id)) n.delete(id);
			else n.add(id);
			return n;
		});

	const filteredInvoices = INVOICES.filter((inv) => {
		if (query && !inv.number.toLowerCase().includes(query.toLowerCase())) {
			return false;
		}
		// Tab filtering could be added here
		return true;
	});

	return (
		<div className="mock-pb">
			{/* Sidebar */}
			<aside className="mock-pb__sidebar">
				{/* Brand */}
				<div className="mock-pb__brand">
					<span className="mock-pb__brand-icon">///</span>
					<span className="mock-pb__brand-name">Untitled UI</span>
				</div>

				{/* Navigation */}
				<nav className="mock-pb__nav" aria-label="Main navigation">
					{NAV_ITEMS.map((item) => {
						const Icon = item.icon;
						return (
							<button
								key={item.id}
								className={`mock-pb__nav-item ${item.active || navItem === item.id ? "is-active" : ""}`}
								onClick={() => setNavItem(item.id)}
							>
								<Icon size={18} aria-hidden="true" />
								<span>{item.label}</span>
							</button>
						);
					})}
				</nav>

				{/* Browser Section */}
				<div className="mock-pb__browser">
					<div className="mock-pb__browser-header">
						<span className="mock-pb__browser-label">BROWSER</span>
						<button className="mock-pb__browser-more" aria-label="More options">
							<svg width="12" height="3" viewBox="0 0 12 3" fill="currentColor">
								<circle cx="1.5" cy="1.5" r="1.5" />
								<circle cx="6" cy="1.5" r="1.5" />
								<circle cx="10.5" cy="1.5" r="1.5" />
							</svg>
						</button>
					</div>

					{/* Projects */}
					<button className="mock-pb__folder-row">
						<ChevronRight size={14} aria-hidden="true" />
						<span>Projects</span>
					</button>

					{/* Folders */}
					<button
						className="mock-pb__folder-row"
						onClick={() => setFoldersExpanded(!foldersExpanded)}
						aria-expanded={foldersExpanded}
					>
						<ChevronRight
							size={14}
							className={foldersExpanded ? "is-expanded" : ""}
							aria-hidden="true"
						/>
						<span>Folders</span>
					</button>

					{foldersExpanded && (
						<div className="mock-pb__folder-children">
							{FOLDERS.map((folder) => (
								<button key={folder.id} className="mock-pb__folder-item">
									<ChevronRight size={12} aria-hidden="true" />
									<Folder size={14} aria-hidden="true" />
									<span>{folder.label}</span>
								</button>
							))}
						</div>
					)}
				</div>

				{/* Documentation Footer */}
				<div className="mock-pb__sidebar-footer">
					<button className="mock-pb__docs-btn">
						<BookOpen size={16} aria-hidden="true" />
						<span>Documentation</span>
					</button>
				</div>
			</aside>

			{/* Main Content */}
			<main className="mock-pb__main">
				{/* Header */}
				<header className="mock-pb__header">
					<div className="mock-pb__header-left">
						<h1>Plans & billing</h1>
						<p>Manage your plan and billing history here.</p>
					</div>
					<div className="mock-pb__header-right">
						<Badge tone="neutral" size="sm">
							14 days left
						</Badge>
						<Button
							size="sm"
							variant="secondary"
							className="mock-pb__upgrade-btn"
						>
							<Sparkles size={14} aria-hidden="true" />
							Upgrade to PRO
						</Button>
						<Avatar name="Olivia Rhye" size="md" />
					</div>
				</header>

				{/* Plans Section */}
				<section className="mock-pb__plans">
					<PlanCard
						name="Free plan"
						price="FREE"
						features={FREE_FEATURES}
						isCurrent
					/>
					<PlanCard
						name="PRO Business"
						price="$20/mth"
						features={PRO_BUSINESS_FEATURES}
					/>
					<PlanCard
						name="PRO Enterprise"
						price="$40/mth"
						features={PRO_ENTERPRISE_FEATURES}
					/>
				</section>

				{/* Invoices Section */}
				<section className="mock-pb__invoices">
					<h3>Previous invoices</h3>

					<div className="mock-pb__invoices-toolbar">
						<Tabs
							aria-label="Invoice filters"
							value={invoiceTab}
							onValueChange={setInvoiceTab}
							items={[
								{ id: "all", label: "View all" },
								{ id: "active", label: "Active" },
								{ id: "archived", label: "Archived" },
							]}
						/>
						<div className="mock-pb__invoices-actions">
							<SearchInput
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search"
								aria-label="Search invoices"
								className="mock-pb__search"
							/>
							<Select
								aria-label="Sort invoices"
								defaultValue="recent"
								options={[
									{ value: "recent", label: "Most recent" },
									{ value: "oldest", label: "Oldest first" },
									{ value: "amount", label: "By amount" },
								]}
							/>
						</div>
					</div>

					<div className="mock-pb__invoices-table">
						<table>
							<tbody>
								{filteredInvoices.map((inv) => (
									<tr
										key={inv.id}
										className={selected.has(inv.id) ? "is-selected" : ""}
									>
										<td className="mock-pb__check-col">
											<Checkbox
												checked={selected.has(inv.id)}
												onChange={() => toggle(inv.id)}
												aria-label={`Select ${inv.number}`}
											/>
										</td>
										<td className="mock-pb__invoice-num">{inv.number}</td>
										<td className="mock-pb__invoice-date">{inv.date}</td>
										<td className="mock-pb__invoice-plan">{inv.plan}</td>
										<td className="mock-pb__invoice-amount">{inv.amount}</td>
										<td className="mock-pb__invoice-action">
											<IconButton
												icon={<Download size={16} />}
												label={`Download ${inv.number}`}
												variant="ghost"
												size="sm"
											/>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>
			</main>
		</div>
	);
}
