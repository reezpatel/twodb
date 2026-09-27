import {
	ChevronDown,
	Clock,
	CreditCard,
	DollarSign,
	Download,
	FileText,
	Filter,
	Headphones,
	Home,
	LayoutGrid,
	LogOut,
	MoreVertical,
	PieChart,
	Search,
	Settings,
	TrendingUp,
	Wallet,
	X,
} from "lucide-react";
import "./finance-dashboard.css";

/* ---------- Types ---------- */

interface Subscription {
	id: string;
	name: string;
	icon: string;
	iconColor: string;
	amount: number;
	frequency: string;
	nextDate: string;
}

interface Transaction {
	id: string;
	date: string;
	description: string;
	amount: number;
	status: "pending" | "completed";
}

interface DaySpending {
	day: string;
	amount: number;
	active?: boolean;
}

/* ---------- Data ---------- */

const SUBSCRIPTIONS: Subscription[] = [
	{
		id: "1",
		name: "Netflix",
		icon: "N",
		iconColor: "netflix",
		amount: 15.99,
		frequency: "Monthly",
		nextDate: "Dec 15",
	},
	{
		id: "2",
		name: "Apple iCloud",
		icon: "",
		iconColor: "apple",
		amount: 9.99,
		frequency: "Monthly",
		nextDate: "Dec 8",
	},
	{
		id: "3",
		name: "Microsoft",
		icon: "⊞",
		iconColor: "microsoft",
		amount: 54.99,
		frequency: "Monthly",
		nextDate: "Dec 14",
	},
	{
		id: "4",
		name: "Spotify Premium",
		icon: "♪",
		iconColor: "spotify",
		amount: 9.99,
		frequency: "Monthly",
		nextDate: "Dec 15",
	},
	{
		id: "5",
		name: "Adobe Creative",
		icon: "A",
		iconColor: "adobe",
		amount: 16.99,
		frequency: "Monthly",
		nextDate: "Dec 14",
	},
];

const WEEKLY_SPENDING: DaySpending[] = [
	{ day: "mon", amount: 85 },
	{ day: "tue", amount: 120 },
	{ day: "wed", amount: 450, active: true },
	{ day: "thu", amount: 380 },
	{ day: "fri", amount: 220 },
	{ day: "sat", amount: 95 },
	{ day: "sun", amount: 65 },
];

const TRANSACTIONS: Transaction[] = [
	{
		id: "1",
		date: "Dec 8, 2024",
		description: "Starbucks Coffee",
		amount: -5.42,
		status: "pending",
	},
	{
		id: "2",
		date: "Dec 8, 2024",
		description: "Starbucks Coffee",
		amount: -5.42,
		status: "pending",
	},
	{
		id: "3",
		date: "Dec 8, 2024",
		description: "Starbucks Coffee",
		amount: -5.42,
		status: "pending",
	},
	{
		id: "4",
		date: "Dec 8, 2024",
		description: "Starbucks Coffee",
		amount: -5.42,
		status: "pending",
	},
];

const NAV_ITEMS = [
	{ id: "dashboard", label: "Dashboard", icon: Home, active: true },
	{ id: "transactions", label: "Transactions", icon: CreditCard },
	{ id: "spending", label: "Spending", icon: Wallet },
	{ id: "investment", label: "Investment", icon: TrendingUp },
];

const MGMT_ITEMS = [
	{ id: "planning", label: "Financial Planning", icon: PieChart },
	{ id: "management", label: "Management", icon: LayoutGrid, badge: "New" },
	{ id: "subscriptions", label: "Subscriptions", icon: CreditCard },
];

/* ---------- Components ---------- */

function Sidebar() {
	return (
		<aside className="mock-finance__sidebar">
			{/* Brand */}
			<div className="mock-finance__brand">
				<span className="mock-finance__logo">W</span>
				<span className="mock-finance__brand-name">
					WealthWise
					<ChevronDown aria-hidden="true" />
				</span>
				<span className="mock-finance__brand-icon">
					<LayoutGrid aria-hidden="true" />
				</span>
			</div>

			{/* Search */}
			<div className="mock-finance__search">
				<Search aria-hidden="true" />
				<span>Search</span>
				<kbd>⌘K</kbd>
			</div>

			{/* Main nav */}
			<nav className="mock-finance__nav-section">
				<div className="mock-finance__nav-label">Main menu</div>
				{NAV_ITEMS.map((item) => (
					<button
						key={item.id}
						className={`mock-finance__nav-item${item.active ? " is-active" : ""}`}
					>
						<item.icon aria-hidden="true" />
						{item.label}
					</button>
				))}
			</nav>

			{/* Management nav */}
			<nav className="mock-finance__nav-section">
				<div className="mock-finance__nav-label">Managements</div>
				{MGMT_ITEMS.map((item) => (
					<button key={item.id} className="mock-finance__nav-item">
						<item.icon aria-hidden="true" />
						{item.label}
						{item.badge && (
							<span className="mock-finance__nav-badge">{item.badge}</span>
						)}
					</button>
				))}
			</nav>

			{/* Support card */}
			<div className="mock-finance__support">
				<div className="mock-finance__support-head">
					<span className="mock-finance__support-title">
						<Headphones aria-hidden="true" />
						Need support
					</span>
					<button className="mock-finance__support-close">
						<X aria-hidden="true" />
					</button>
				</div>
				<p className="mock-finance__support-text">
					Contact with one of our expert to get support.
				</p>
				<button className="mock-finance__support-btn">Call the expert</button>
			</div>

			{/* Footer */}
			<div className="mock-finance__sidebar-foot">
				<button className="mock-finance__nav-item">
					<Settings aria-hidden="true" />
					Settings
				</button>
				<button className="mock-finance__nav-item">
					<LogOut aria-hidden="true" />
					Log Out
				</button>
			</div>
		</aside>
	);
}

function TopBar() {
	return (
		<header className="mock-finance__topbar">
			<div className="mock-finance__breadcrumb">
				Dashboard / <strong>Budget & Spending</strong>
			</div>
			<div className="mock-finance__user">
				<span className="mock-finance__user-avatar">MS</span>
				<span className="mock-finance__user-name">
					Mohammad Shakib
					<ChevronDown aria-hidden="true" />
				</span>
			</div>
		</header>
	);
}

function StatCards() {
	const stats = [
		{
			label: "Total Balance",
			value: "$188,778.24",
			icon: DollarSign,
			negative: false,
		},
		{
			label: "Monthly Recurring",
			value: "$189.97",
			icon: Clock,
			negative: false,
		},
		{
			label: "This Month",
			value: "-$2,341.50",
			icon: Clock,
			negative: true,
		},
	];

	return (
		<div className="mock-finance__stats">
			{stats.map((stat, i) => (
				<div key={i} className="mock-finance__stat-card">
					<div className="mock-finance__stat-header">
						<span className="mock-finance__stat-label">
							<stat.icon aria-hidden="true" />
							{stat.label}
						</span>
						<button className="mock-finance__stat-more">
							<MoreVertical aria-hidden="true" />
						</button>
					</div>
					<div
						className={`mock-finance__stat-value${stat.negative ? " mock-finance__stat-value--negative" : ""}`}
					>
						{stat.value}
					</div>
				</div>
			))}
		</div>
	);
}

function RecurringTransactions() {
	const total = SUBSCRIPTIONS.reduce((sum, s) => sum + s.amount, 0);

	return (
		<div className="mock-finance__card">
			<div className="mock-finance__card-header">
				<span className="mock-finance__card-title">Recurring Transactions</span>
				<span className="mock-finance__card-badge">
					${total.toFixed(2)}/month
				</span>
			</div>
			<div className="mock-finance__recurring">
				{SUBSCRIPTIONS.map((sub) => (
					<div key={sub.id} className="mock-finance__subscription">
						<span
							className={`mock-finance__sub-icon mock-finance__sub-icon--${sub.iconColor}`}
						>
							{sub.icon}
						</span>
						<div className="mock-finance__sub-info">
							<div className="mock-finance__sub-name">{sub.name}</div>
							<div className="mock-finance__sub-date">Next: {sub.nextDate}</div>
						</div>
						<div className="mock-finance__sub-amount">
							<div className="mock-finance__sub-price">
								${sub.amount.toFixed(2)}
							</div>
							<div className="mock-finance__sub-freq">{sub.frequency}</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function WeeklySpendingChart() {
	const maxAmount = Math.max(...WEEKLY_SPENDING.map((d) => d.amount));
	const total = WEEKLY_SPENDING.reduce((sum, d) => sum + d.amount, 0);

	return (
		<div className="mock-finance__card">
			<div className="mock-finance__card-header">
				<span className="mock-finance__card-title">Weekly Spending</span>
				<span className="mock-finance__card-badge">
					${total.toFixed(2)}/month
				</span>
			</div>
			<div className="mock-finance__chart">
				<div className="mock-finance__chart-container">
					<div className="mock-finance__chart-yaxis">
						<span>600</span>
						<span>450</span>
						<span>300</span>
						<span>150</span>
						<span>0</span>
					</div>
					<div className="mock-finance__chart-bars">
						{WEEKLY_SPENDING.map((day) => (
							<div key={day.day} className="mock-finance__bar-wrapper">
								<div
									className={`mock-finance__bar${day.active ? " mock-finance__bar--active" : ""}`}
									style={{
										height: `${(day.amount / maxAmount) * 150}px`,
									}}
								/>
							</div>
						))}
					</div>
				</div>
				<div className="mock-finance__chart-xaxis">
					{WEEKLY_SPENDING.map((day) => (
						<span key={day.day} className={day.active ? "is-active" : ""}>
							{day.day}
						</span>
					))}
				</div>
			</div>
		</div>
	);
}

function CashflowGauge() {
	const percentage = 83.6;
	const lastMonth = 80.8;

	// SVG arc parameters
	const radius = 70;
	const cx = 100;
	const cy = 90;
	const circumference = Math.PI * radius;
	const strokeDasharray = circumference;
	const strokeDashoffset = circumference * (1 - percentage / 100);

	return (
		<div className="mock-finance__card">
			<div className="mock-finance__card-header">
				<span className="mock-finance__card-title">Cashflow Analytics</span>
				<button className="mock-finance__stat-more">
					<MoreVertical aria-hidden="true" />
				</button>
			</div>
			<div className="mock-finance__gauge">
				<svg className="mock-finance__gauge-svg" viewBox="0 0 200 120">
					{/* Background arc */}
					<path
						className="mock-finance__gauge-bg"
						d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
						fill="none"
					/>
					{/* Value arc */}
					<path
						className="mock-finance__gauge-value"
						d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
						fill="none"
						strokeDasharray={strokeDasharray}
						strokeDashoffset={strokeDashoffset}
						style={{
							transformOrigin: `${cx}px ${cy}px`,
							transform: "rotate(0deg)",
						}}
					/>
					{/* Tick marks */}
					{Array.from({ length: 20 }).map((_, i) => {
						const angle = Math.PI + (Math.PI * i) / 19;
						const innerR = radius - 8;
						const outerR = radius + 8;
						const x1 = cx + innerR * Math.cos(angle);
						const y1 = cy + innerR * Math.sin(angle);
						const x2 = cx + outerR * Math.cos(angle);
						const y2 = cy + outerR * Math.sin(angle);
						return (
							<line
								key={i}
								className="mock-finance__gauge-ticks"
								x1={x1}
								y1={y1}
								x2={x2}
								y2={y2}
							/>
						);
					})}
					{/* Center text */}
					<text className="mock-finance__gauge-center" x={cx} y={cy - 10}>
						<tspan className="mock-finance__gauge-percent">{percentage}%</tspan>
					</text>
					<text className="mock-finance__gauge-center" x={cx} y={cy + 12}>
						<tspan className="mock-finance__gauge-compare">
							vs last month: {lastMonth}%
						</tspan>
					</text>
				</svg>
				<div className="mock-finance__gauge-scale">
					<span>0</span>
					<span>100</span>
				</div>
				<div className="mock-finance__gauge-label">
					<span className="mock-finance__gauge-label-dot" />
					Reporting Rate for Reported Active Capital
				</div>
			</div>
		</div>
	);
}

function RecentTransactions() {
	return (
		<div className="mock-finance__card">
			<div className="mock-finance__card-header">
				<span className="mock-finance__card-title">Recent Transactions</span>
				<div className="mock-finance__card-actions">
					<button className="mock-finance__card-btn">
						<Download aria-hidden="true" />
						Export As CSV
						<ChevronDown aria-hidden="true" />
					</button>
					<button className="mock-finance__card-btn">
						<Filter aria-hidden="true" />
						Filter
					</button>
				</div>
			</div>
			<div className="mock-finance__table">
				<div className="mock-finance__table-head">
					<span>Date</span>
					<span>Description</span>
					<span>Amount</span>
					<span>Status</span>
					<span>Receipt</span>
				</div>
				{TRANSACTIONS.map((tx) => (
					<div key={tx.id} className="mock-finance__table-row">
						<span className="mock-finance__table-date">{tx.date}</span>
						<span className="mock-finance__table-desc">{tx.description}</span>
						<span className="mock-finance__table-amount">
							${Math.abs(tx.amount).toFixed(2)}
						</span>
						<span
							className={`mock-finance__table-status mock-finance__table-status--${tx.status}`}
						>
							{tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
						</span>
						<span className="mock-finance__table-receipt">
							<FileText aria-hidden="true" />
							<button className="mock-finance__table-more">
								<MoreVertical aria-hidden="true" />
							</button>
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

/* ---------- Main Component ---------- */

export function FinanceDashboardMock() {
	return (
		<div className="mock-finance">
			<Sidebar />
			<main className="mock-finance__main">
				<TopBar />
				<div className="mock-finance__content">
					<StatCards />
					<div className="mock-finance__grid">
						<RecurringTransactions />
						<WeeklySpendingChart />
					</div>
					<div className="mock-finance__grid">
						<CashflowGauge />
						<RecentTransactions />
					</div>
				</div>
			</main>
		</div>
	);
}
