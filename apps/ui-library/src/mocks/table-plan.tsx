import { useMemo, useState } from "react";
import { Badge, Button, IconButton, SearchInput } from "@twodb/ui";
import {
	ChevronLeft,
	ChevronRight,
	Phone,
	Plus,
	SlidersHorizontal,
	Users,
} from "lucide-react";

/* ---------- data ---------- */

type TableStatus = "available" | "reserved" | "dine";
type Zone = "main" | "terrace" | "outdoor";

interface FloorTable {
	id: string;
	seats: number;
	status: TableStatus;
	/** canvas geometry, percent of the floor */
	x: number;
	y: number;
	w: number;
	h: number;
}

interface Reservation {
	id: string;
	name: string;
	time: string;
	tableId: string | null;
	party: number;
	phone?: string;
	state: "dinner" | "on-dine" | "unpaid" | "free";
}

const FLOORS: Record<Zone, FloorTable[]> = {
	main: [
		{ id: "T1", seats: 6, status: "available", x: 4, y: 4, w: 24, h: 16 },
		{ id: "T2", seats: 2, status: "dine", x: 42, y: 5, w: 14, h: 14 },
		{ id: "T3", seats: 2, status: "dine", x: 72, y: 5, w: 14, h: 14 },
		{ id: "T4", seats: 3, status: "dine", x: 8, y: 34, w: 14, h: 14 },
		{ id: "T5", seats: 4, status: "available", x: 34, y: 34, w: 14, h: 14 },
		{ id: "T6", seats: 7, status: "reserved", x: 62, y: 32, w: 26, h: 17 },
		{ id: "T7", seats: 10, status: "available", x: 6, y: 62, w: 28, h: 18 },
		{ id: "T8", seats: 2, status: "dine", x: 48, y: 63, w: 13, h: 14 },
		{ id: "T9", seats: 4, status: "dine", x: 74, y: 62, w: 15, h: 15 },
		{ id: "T10", seats: 2, status: "dine", x: 8, y: 88, w: 13, h: 12 },
		{ id: "T11", seats: 2, status: "reserved", x: 40, y: 88, w: 13, h: 12 },
		{ id: "T12", seats: 8, status: "available", x: 66, y: 86, w: 24, h: 14 },
	],
	terrace: [
		{ id: "T13", seats: 4, status: "reserved", x: 8, y: 10, w: 18, h: 16 },
		{ id: "T14", seats: 2, status: "available", x: 42, y: 10, w: 14, h: 14 },
		{ id: "T15", seats: 2, status: "dine", x: 72, y: 10, w: 14, h: 14 },
		{ id: "T16", seats: 6, status: "available", x: 12, y: 46, w: 24, h: 17 },
		{ id: "T17", seats: 4, status: "reserved", x: 54, y: 46, w: 18, h: 16 },
		{ id: "T18", seats: 2, status: "available", x: 36, y: 78, w: 14, h: 14 },
	],
	outdoor: [
		{ id: "T19", seats: 2, status: "available", x: 8, y: 8, w: 13, h: 13 },
		{ id: "T20", seats: 2, status: "dine", x: 34, y: 8, w: 13, h: 13 },
		{ id: "T21", seats: 2, status: "available", x: 60, y: 8, w: 13, h: 13 },
		{ id: "T22", seats: 4, status: "dine", x: 82, y: 6, w: 15, h: 15 },
		{ id: "T23", seats: 2, status: "available", x: 8, y: 40, w: 13, h: 13 },
		{ id: "T24", seats: 4, status: "available", x: 36, y: 40, w: 16, h: 15 },
		{ id: "T25", seats: 2, status: "reserved", x: 68, y: 40, w: 13, h: 13 },
		{ id: "T26", seats: 6, status: "available", x: 30, y: 72, w: 26, h: 16 },
	],
};

const RESERVATIONS: Reservation[] = [
	{
		id: "r1",
		name: "Uthman ibn Hunaif",
		time: "7:30 pm",
		tableId: "T6",
		party: 6,
		phone: "+91 84678 90000",
		state: "dinner",
	},
	{
		id: "r2",
		name: "Bashir ibn Sa'ad",
		time: "On dine",
		tableId: "T2",
		party: 2,
		state: "on-dine",
	},
	{
		id: "r3",
		name: "Ali",
		time: "8:00 pm",
		tableId: "T11",
		party: 2,
		phone: "+91 84342 56555",
		state: "dinner",
	},
	{
		id: "r4",
		name: "Khunais ibn Hudhafa",
		time: "On dine",
		tableId: "T9",
		party: 4,
		state: "on-dine",
	},
	{
		id: "r5",
		name: "Walk-in waitlist",
		time: "Free",
		tableId: null,
		party: 0,
		state: "free",
	},
	{
		id: "r6",
		name: "Mus'ab ibn Umayr",
		time: "8:25 pm",
		tableId: "T13",
		party: 4,
		phone: "+91 84800 63554",
		state: "unpaid",
	},
	{
		id: "r7",
		name: "Shuja ibn Wahb",
		time: "9:00 pm",
		tableId: "T17",
		party: 4,
		phone: "+91 84901 22310",
		state: "dinner",
	},
];

const STATE_BADGE: Record<
	Reservation["state"],
	{ label: string; tone: "go" | "rose" | "warning" | "neutral" }
> = {
	dinner: { label: "Payment", tone: "go" },
	"on-dine": { label: "On Dine", tone: "rose" },
	unpaid: { label: "Unpaid", tone: "warning" },
	free: { label: "Free", tone: "neutral" },
};

const ZONES: { id: Zone; label: string }[] = [
	{ id: "main", label: "Main Dining" },
	{ id: "terrace", label: "Terrace" },
	{ id: "outdoor", label: "Outdoor" },
];

/* ---------- chairs: small ticks along the two long sides ---------- */

function chairLayout(t: FloorTable): { left: string; top: string }[] {
	const horizontal = t.w >= t.h; // chairs above + below, else left + right
	const perSide = Math.max(1, Math.round(t.seats / 2));
	const chairs: { left: string; top: string }[] = [];
	for (let i = 0; i < perSide; i++) {
		const p = ((i + 0.5) / perSide) * 100;
		if (horizontal) {
			chairs.push({ left: `${p}%`, top: "-9px" });
			chairs.push({ left: `${p}%`, top: "calc(100% + 3px)" });
		} else {
			chairs.push({ left: "-9px", top: `${p}%` });
			chairs.push({ left: "calc(100% + 3px)", top: `${p}%` });
		}
	}
	return chairs;
}

/* ---------- the mock ---------- */

export function TablePlanMock() {
	const [zone, setZone] = useState<Zone>("main");
	const [filter, setFilter] = useState<"all" | "reserved" | "dine">("all");
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<string | null>(null);

	const tables = FLOORS[zone];

	const visible = useMemo(() => {
		return RESERVATIONS.filter((r) => {
			if (
				filter === "reserved" &&
				!(r.state === "dinner" || r.state === "unpaid")
			)
				return false;
			if (filter === "dine" && r.state !== "on-dine") return false;
			if (query && !r.name.toLowerCase().includes(query.toLowerCase()))
				return false;
			return true;
		});
	}, [filter, query]);

	const counts = {
		all: RESERVATIONS.length,
		reserved: RESERVATIONS.filter(
			(r) => r.state === "dinner" || r.state === "unpaid",
		).length,
		dine: RESERVATIONS.filter((r) => r.state === "on-dine").length,
	};

	return (
		<div className="mock-tp">
			{/* reservations column */}
			<aside className="mock-tp__side">
				<div
					className="mock-tp__filters"
					role="tablist"
					aria-label="Reservation filter"
				>
					{(
						[
							{ id: "all", label: "All", n: counts.all },
							{ id: "reserved", label: "Reservation", n: counts.reserved },
							{ id: "dine", label: "On Dine", n: counts.dine },
						] as const
					).map((f) => (
						<button
							key={f.id}
							role="tab"
							aria-selected={filter === f.id}
							className={
								filter === f.id
									? "mock-tp__filter is-active"
									: "mock-tp__filter"
							}
							onClick={() => setFilter(f.id)}
						>
							{f.label}
							<span className="mock-tp__fcount">{f.n}</span>
						</button>
					))}
				</div>

				<div className="mock-tp__date">
					<IconButton
						icon={<ChevronLeft />}
						label="Previous day"
						variant="ghost"
						size="sm"
					/>
					<span>Thu, 8 August 2026</span>
					<IconButton
						icon={<ChevronRight />}
						label="Next day"
						variant="ghost"
						size="sm"
					/>
				</div>

				<div className="mock-tp__search">
					<SearchInput
						placeholder="Search guests"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						aria-label="Search guests"
					/>
					<IconButton
						icon={<SlidersHorizontal />}
						label="Filter"
						variant="ghost"
					/>
				</div>

				<div className="mock-tp__list">
					{visible.map((r) => (
						<button
							key={r.id}
							className={
								selected === r.id
									? "mock-tp__card is-selected"
									: "mock-tp__card"
							}
							onClick={() => setSelected(selected === r.id ? null : r.id)}
						>
							<span className={`mock-tp__time mock-tp__time--${r.state}`}>
								{r.time}
							</span>
							<span className="mock-tp__cardbody">
								<span className="mock-tp__cardhead">
									<span className="mock-tp__name">{r.name}</span>
									<Badge size="sm" tone={STATE_BADGE[r.state].tone}>
										{STATE_BADGE[r.state].label}
									</Badge>
								</span>
								<span className="mock-tp__cardmeta">
									{r.tableId ? `${r.tableId} · ` : ""}
									<Users aria-hidden="true" /> {r.party || "—"}
								</span>
								{r.phone ? (
									<span className="mock-tp__cardmeta">
										<Phone aria-hidden="true" /> {r.phone}
									</span>
								) : null}
							</span>
						</button>
					))}
				</div>

				<Button className="mock-tp__add">
					<Plus aria-hidden="true" /> Add new reservation
				</Button>
			</aside>

			{/* floor plan */}
			<section className="mock-tp__main">
				<header className="mock-tp__mainhead">
					<h2>Manage Tables</h2>
					<div
						className="mock-tp__zones"
						role="tablist"
						aria-label="Floor zone"
					>
						{ZONES.map((z) => (
							<button
								key={z.id}
								role="tab"
								aria-selected={zone === z.id}
								className={
									zone === z.id ? "mock-tp__zone is-active" : "mock-tp__zone"
								}
								onClick={() => {
									setZone(z.id);
									setSelected(null);
								}}
							>
								{z.label}
							</button>
						))}
					</div>
				</header>

				<div className="mock-tp__legend">
					<span className="mock-tp__leg">
						<i className="mock-tp__dot mock-tp__dot--available" /> Available
					</span>
					<span className="mock-tp__leg">
						<i className="mock-tp__dot mock-tp__dot--reserved" /> Reserved
					</span>
					<span className="mock-tp__leg">
						<i className="mock-tp__dot mock-tp__dot--dine" /> On Dine
					</span>
				</div>

				<div className="mock-tp__floor">
					{tables.map((t) => {
						const linked = RESERVATIONS.find((r) => r.tableId === t.id);
						const isSel = selected && linked?.id === selected;
						return (
							<button
								key={t.id}
								className={`mock-tp__table mock-tp__table--${t.status}${isSel ? " is-selected" : ""}`}
								style={{
									left: `${t.x}%`,
									top: `${t.y}%`,
									width: `${t.w}%`,
									height: `${t.h}%`,
								}}
								onClick={() => linked && setSelected(isSel ? null : linked.id)}
								aria-label={`Table ${t.id.slice(1)}, ${t.seats} seats, ${t.status}`}
							>
								{chairLayout(t).map((c, i) => (
									<span
										key={i}
										className="mock-tp__chair"
										style={c}
										aria-hidden="true"
									/>
								))}
								<span className="mock-tp__tlabel">Table #{t.id.slice(1)}</span>
								<span className="mock-tp__tseats">
									<Users aria-hidden="true" /> {linked?.party || t.seats}
								</span>
							</button>
						);
					})}
				</div>
			</section>
		</div>
	);
}
