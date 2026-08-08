import { Avatar, Badge, Button } from "@twodb/ui";
import {
	Bell,
	Box,
	ChevronDown,
	ChevronUp,
	Crown,
	DollarSign,
	Grid2X2,
	LayoutDashboard,
	LifeBuoy,
	Moon,
	Package,
	PanelLeft,
	Search,
	Settings,
	ShoppingBag,
	SlidersHorizontal,
	Trophy,
	Users,
	WalletCards,
} from "lucide-react";

const STATS = [
	{ label: "Total Products", value: "1,525", icon: <Package />, tone: "blue" },
	{ label: "Total Sales", value: "10,892", icon: <DollarSign />, tone: "violet" },
	{ label: "Total Income", value: "$157,342", icon: <ChevronDown />, tone: "green" },
	{ label: "Total Expenses", value: "$12,453", icon: <ChevronUp />, tone: "red" },
];

const NAV = [
	{ label: "Dashboard", icon: <LayoutDashboard />, active: true },
	{ label: "Products", icon: <Package /> },
	{ label: "Orders", icon: <ShoppingBag />, open: true },
	{ label: "Sales", icon: <DollarSign /> },
	{ label: "Customers", icon: <Users /> },
	{ label: "Reports", icon: <WalletCards /> },
];

const REVENUE = [
	{ month: "Jan", one: 102, recurring: 122 },
	{ month: "Feb", one: 38, recurring: 122 },
	{ month: "Mar", one: 56, recurring: 136 },
	{ month: "Apr", one: 104, recurring: 108, active: true },
	{ month: "May", one: 98, recurring: 130 },
	{ month: "Jun", one: 34, recurring: 118 },
	{ month: "Jul", one: 120, recurring: 144 },
	{ month: "Aug", one: 55, recurring: 122 },
];

const ACTIVITIES = [
	{ title: "Order #2048", detail: "John Doe · 12 Jan 25", tag: "New Order", tone: "go" as const },
	{ title: "Low Stock Alert", detail: "MacBook Air M2 · 10 Jan 25", tag: "Low Stock", tone: "danger" as const },
	{ title: "Promo code \"SUMMER20\"", detail: "Applied 52 times · 8 Jan 25", tag: "Campaign", tone: "rose" as const },
	{ title: "System Update", detail: "Version 1.21 · 2 Jan 25", tag: "System", tone: "neutral" as const },
];

const PRODUCTS = [
	{ product: "iPhone 15 Pro", stock: "6,200", price: "$999.00", sales: "4,800", earnings: "$4,795,200" },
	{ product: "MacBook Air M2", stock: "1,020", price: "$1,299", sales: "3,200", earnings: "$4,156,800" },
	{ product: "Google Pixel 8", stock: "1,500", price: "$699.00", sales: "800", earnings: "$559,200" },
	{ product: "Nike Air Max 90", stock: "2,400", price: "$130.00", sales: "1,800", earnings: "$234,000" },
	{ product: "Galaxy Buds Pro", stock: "850", price: "$199.00", sales: "1,000", earnings: "$199,000" },
];

function StatCard({ item }: { item: (typeof STATS)[number] }) {
	return (
		<section className={`mock-prodex__stat mock-prodex__stat--${item.tone}`}>
			<span className="mock-prodex__stat-icon">{item.icon}</span>
			<div>
				<span>{item.label}</span>
				<strong className="tw-tnum">{item.value}</strong>
			</div>
		</section>
	);
}

function RevenueChart() {
	return (
		<section className="mock-prodex__panel mock-prodex__revenue">
			<header className="mock-prodex__panel-head">
				<div>
					<span className="mock-prodex__mini-icon"><WalletCards /></span>
					<strong>Sales Revenue</strong>
				</div>
				<div className="mock-prodex__segments" aria-label="Chart period">
					<button className="is-active">Monthly</button>
					<button>Quarterly</button>
					<button>Yearly</button>
				</div>
			</header>
			<div className="mock-prodex__legend">
				<span><i /> One-Time Revenue</span>
				<span><i /> Recurring Revenue</span>
			</div>
			<div className="mock-prodex__chart" aria-label="Sales revenue bar chart">
				<div className="mock-prodex__axis">
					<span>150K</span>
					<span>130K</span>
					<span>100K</span>
					<span>50K</span>
					<span>10K</span>
					<span>0</span>
				</div>
				<div className="mock-prodex__bars">
					{REVENUE.map((item) => (
						<div className="mock-prodex__barcol" key={item.month}>
							<div className={item.active ? "mock-prodex__bar is-active" : "mock-prodex__bar"}>
								<span className="mock-prodex__bar-one" style={{ height: `${item.one}px` }} />
								<span className="mock-prodex__bar-rec" style={{ height: `${item.recurring}px` }} />
								{item.active ? (
									<span className="mock-prodex__tip"><b>One-Time Revenue</b>$6,000<br /><b>Recurring Revenue</b>$25,000</span>
								) : null}
							</div>
							<small>{item.month}</small>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

function CategoryRing() {
	return (
		<section className="mock-prodex__panel mock-prodex__category">
			<header className="mock-prodex__panel-head">
				<div><span className="mock-prodex__mini-icon"><Trophy /></span><strong>Top Categories</strong></div>
				<Button size="sm" variant="secondary">See All</Button>
			</header>
			<div className="mock-prodex__donut" aria-label="Top categories donut chart">
				<svg viewBox="0 0 120 120" role="img" aria-label="Total sales 125,000">
					<circle className="track" cx="60" cy="60" r="42" />
					<circle className="seg seg-a" cx="60" cy="60" r="42" pathLength="100" />
					<circle className="seg seg-b" cx="60" cy="60" r="42" pathLength="100" />
					<circle className="seg seg-c" cx="60" cy="60" r="42" pathLength="100" />
					<circle className="seg seg-d" cx="60" cy="60" r="42" pathLength="100" />
				</svg>
				<div><span>Total Sales</span><strong className="tw-tnum">$125,000</strong></div>
			</div>
			<div className="mock-prodex__cat-list">
				{[
					["Electronics", "$85,000", "68%", "a"],
					["Fashion", "$25,000", "20%", "b"],
					["Health & Wellness", "$10,000", "8%", "c"],
					["Home & Living", "$5,000", "4%", "d"],
				].map(([name, amount, pct, tone]) => (
					<div key={name}><span className={`dot dot-${tone}`} /> <b>{name}</b><em>{amount}</em><strong>{pct}</strong></div>
				))}
			</div>
		</section>
	);
}

export function ProdexDashboardMock() {
	return (
		<div className="mock-prodex" aria-label="Prodex dashboard mock">
			<aside className="mock-prodex__side">
				<div className="mock-prodex__brand"><span><Grid2X2 /></span><strong>Prodex</strong><PanelLeft /></div>
				<div className="mock-prodex__workspace"><span>UX</span><b>Uxerflow</b><ChevronDown /></div>
				<nav aria-label="Prodex navigation">
					<span className="mock-prodex__navlabel">Main</span>
					{NAV.map((item) => <button type="button" className={item.active ? "is-active" : ""} key={item.label}>{item.icon}<span>{item.label}</span>{item.open ? <ChevronUp /> : null}</button>)}
					<div className="mock-prodex__sub"><span>All Orders</span><span>Returns</span><span>Order Tracking</span></div>
					<span className="mock-prodex__navlabel">Settings</span>
					<button type="button"><Box /><span>Marketplace Sync</span></button>
					<button type="button"><WalletCards /><span>Payment Gateways</span></button>
					<button type="button"><Settings /><span>Settings</span><ChevronDown /></button>
					<button type="button"><LifeBuoy /><span>Help Center</span></button>
				</nav>
				<div className="mock-prodex__dark"><Moon /> <span>Dark More</span><i /></div>
				<div className="mock-prodex__upgrade"><Crown /><strong>Upgrade to <Badge tone="go">Premium</Badge></strong><p>Your Premium Account will expire in <b>18 days.</b></p><Button size="sm">Upgrade Now</Button></div>
			</aside>

			<main className="mock-prodex__main">
				<header className="mock-prodex__top">
					<h2>Dashboard</h2>
					<div className="mock-prodex__team"><Avatar name="Nia Cruz" size="sm" /><Avatar name="Maya Patel" size="sm" /><span>+2</span><Button size="sm" variant="secondary">+</Button></div>
					<button className="mock-prodex__bell"><Bell /><sup>24</sup></button>
					<label className="mock-prodex__search"><Search /><input placeholder="Search anything" /><kbd>⌘ K</kbd></label>
					<div className="mock-prodex__profile"><Avatar name="Asha Verma" size="sm" /><ChevronDown /></div>
				</header>

				<div className="mock-prodex__stats">{STATS.map((item) => <StatCard key={item.label} item={item} />)}</div>
				<div className="mock-prodex__grid">
					<RevenueChart />
					<CategoryRing />
					<section className="mock-prodex__panel mock-prodex__activity">
						<header className="mock-prodex__panel-head"><div><span className="mock-prodex__mini-icon"><Bell /></span><strong>Recent Activity</strong></div><Button size="sm" variant="secondary">See All</Button></header>
						{ACTIVITIES.map((item) => <div className="mock-prodex__activity-row" key={item.title}><span className={`mock-prodex__activity-icon tone-${item.tone}`}>{item.tone === "danger" ? <Package /> : <Bell />}</span><div><strong>{item.title}</strong><em>{item.detail}</em></div><Badge tone={item.tone}>{item.tag}</Badge></div>)}
					</section>
					<section className="mock-prodex__panel mock-prodex__products">
						<header className="mock-prodex__panel-head"><div><span className="mock-prodex__mini-icon"><Package /></span><strong>Top Products</strong></div><div className="mock-prodex__tools"><Button size="sm" variant="secondary"><SlidersHorizontal /> Sort</Button><Button size="sm" variant="secondary">Filter</Button></div></header>
						<table><thead><tr><th>Product</th><th>Stocks</th><th>Price</th><th>Sales</th><th>Earnings</th></tr></thead><tbody>{PRODUCTS.map((item) => <tr key={item.product}><td><span className="mock-prodex__thumb" />{item.product}</td><td>{item.stock}</td><td>{item.price}</td><td>{item.sales}</td><td>{item.earnings}</td></tr>)}</tbody></table>
					</section>
				</div>
			</main>
		</div>
	);
}
