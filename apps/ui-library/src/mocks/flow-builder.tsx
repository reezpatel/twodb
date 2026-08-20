import { useEffect, useMemo, useRef, useState } from "react";
import { Button, IconButton, SearchInput } from "@twodb/ui";
import {
	Bell,
	Bot,
	Braces,
	CalendarClock,
	ChevronDown,
	Clock,
	Database,
	FileUp,
	FormInput,
	GitBranch,
	type Globe,
	Languages,
	Mail,
	MessageSquare,
	Minus,
	Music,
	Play,
	Plus,
	Printer,
	Send,
	Settings2,
	Share2,
	Sigma,
	Split,
	Table2,
	Trash2,
	Variable,
	Webhook,
} from "lucide-react";
import "./flow-builder";

/* --- node library --- */

const LIBRARY: {
	label: string;
	items: { icon: typeof Globe; label: string }[];
}[] = [
	{
		label: "Input",
		items: [
			{ icon: CalendarClock, label: "Schedule" },
			{ icon: FormInput, label: "Form Intake" },
			{ icon: Webhook, label: "Webhook" },
			{ icon: Database, label: "Database Query" },
			{ icon: FileUp, label: "File Upload" },
			{ icon: Table2, label: "Patient Record" },
		],
	},
	{
		label: "Logic",
		items: [
			{ icon: GitBranch, label: "If / Else" },
			{ icon: Share2, label: "Switch" },
			{ icon: GitBranch, label: "Loop / For Each" },
			{ icon: Sigma, label: "Merge" },
			{ icon: Split, label: "Split" },
		],
	},
	{
		label: "AI / Prompt",
		items: [
			{ icon: Bot, label: "Summarize Note" },
			{ icon: Music, label: "Transcribe Call" },
			{ icon: Languages, label: "Translate" },
			{ icon: Braces, label: "Classify" },
		],
	},
	{
		label: "Transform",
		items: [
			{ icon: Variable, label: "Set Variable" },
			{ icon: Braces, label: "Format Text" },
			{ icon: Braces, label: "Parse JSON" },
			{ icon: Clock, label: "Date Formatter" },
		],
	},
	{
		label: "Output",
		items: [
			{ icon: MessageSquare, label: "Send SMS" },
			{ icon: Mail, label: "Send Email" },
			{ icon: Send, label: "Post Webhook" },
			{ icon: Database, label: "Database Insert" },
			{ icon: Bell, label: "WhatsApp" },
			{ icon: Printer, label: "Print" },
		],
	},
];

/* --- canvas nodes --- */

type Row = [label: string, value: string];
interface FlowNode {
	id: string;
	icon: typeof Globe;
	title: string;
	desc: string;
	kind: string;
	x: number;
	y: number;
	w: number;
	rows: Row[];
	code?: string[];
	output?: Row[];
}

const NODES: FlowNode[] = [
	{
		id: "start",
		icon: Play,
		title: "Start",
		desc: "Entry point for this automation",
		kind: "Trigger",
		x: 40,
		y: 20,
		w: 210,
		rows: [
			["Schedule", "Weekdays 08:00"],
			["Output", "run_date"],
		],
	},
	{
		id: "fetch",
		icon: Database,
		title: "Fetch Appointments",
		desc: "Reads today's list from the clinic",
		kind: "Input",
		x: 40,
		y: 160,
		w: 210,
		rows: [
			["Source", "clinic_db"],
			["Query", "today, confirmed only"],
			["Input", "run_date"],
		],
		output: [["rows", "array of appointments"]],
	},
	{
		id: "validate",
		icon: GitBranch,
		title: "Validate List",
		desc: "Skips the run when nothing is due",
		kind: "Logic",
		x: 40,
		y: 350,
		w: 220,
		rows: [["Input", "rows (from Fetch)"]],
		code: [
			"IF (rows.length > 0)",
			"  → remind each patient",
			"ELSE → skip quietly",
		],
		output: [
			["valid_list", "(REMIND branch)"],
			["skip_reason", "(EMPTY branch)"],
		],
	},
	{
		id: "format",
		icon: Braces,
		title: "Format Message",
		desc: "Builds the reminder in plain words",
		kind: "Transform",
		x: 350,
		y: 360,
		w: 230,
		rows: [["Input", "valid_list.patient"]],
		code: [
			'text = "Namaste {name},"',
			'+ "your visit is {time}"',
			'+ " at City Clinic."',
		],
		output: [["message", "ready to send"]],
	},
	{
		id: "send",
		icon: Send,
		title: "Send Reminders",
		desc: "SMS first, email as backup",
		kind: "Output",
		x: 190,
		y: 600,
		w: 230,
		rows: [
			["Channel", "SMS → Email"],
			["Template", "reminder_v2"],
			["Input", "message"],
		],
		output: [["sent_count", "logged for reports"]],
	},
];

/* explicit edge coordinates — matches the layout above */
const EDGES: {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	label?: string;
}[] = [
	{ x1: 145, y1: 122, x2: 145, y2: 160 },
	{ x1: 145, y1: 310, x2: 145, y2: 350 },
	{ x1: 260, y1: 445, x2: 350, y2: 445, label: "Ready" },
	{ x1: 465, y1: 552, x2: 305, y2: 600 },
];

const ZOOMS = [0.75, 1, 1.25];

export function FlowBuilderMock() {
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState<Record<string, boolean>>(() =>
		Object.fromEntries(LIBRARY.map((s) => [s.label, true])),
	);
	const [selected, setSelected] = useState<string | null>(null);
	const [zoom, setZoom] = useState(1);
	const [run, setRun] = useState<"idle" | "running" | "done">("idle");
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const stageRef = useRef<HTMLDivElement>(null);

	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
		},
		[],
	);

	const startRun = () => {
		if (run === "running") return;
		setRun("running");
		timer.current = setTimeout(() => setRun("done"), 2200);
	};

	const visibleLibrary = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return LIBRARY;
		return LIBRARY.map((s) => ({
			...s,
			items: s.items.filter((i) => i.label.toLowerCase().includes(q)),
		})).filter((s) => s.items.length > 0);
	}, [query]);

	const selNode = NODES.find((n) => n.id === selected) ?? null;

	return (
		<div className="mock-fb">
			{/* node library */}
			<aside className="mock-fb__lib">
				<header className="mock-fb__libhead">
					<h3>Node Library</h3>
				</header>
				<SearchInput
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search node or action…"
					aria-label="Search nodes"
				/>
				<div className="mock-fb__libsections">
					{visibleLibrary.map((s) => {
						const isOpen = query.trim() ? true : open[s.label];
						return (
							<div className="mock-fb__section" key={s.label}>
								<button
									className="mock-fb__sectoggle"
									onClick={() =>
										setOpen((m) => ({ ...m, [s.label]: !m[s.label] }))
									}
									aria-expanded={isOpen}
								>
									{s.label}
									<ChevronDown aria-hidden="true" />
								</button>
								{isOpen ? (
									<div className="mock-fb__secgrid">
										{s.items.map((i) => (
											<span className="mock-fb__libitem" key={i.label}>
												<i.icon aria-hidden="true" />
												{i.label}
											</span>
										))}
									</div>
								) : null}
							</div>
						);
					})}
					{!visibleLibrary.length ? (
						<p className="mock-fb__libempty">No nodes match that search.</p>
					) : null}
				</div>
			</aside>

			{/* canvas */}
			<main className="mock-fb__canvas">
				<header className="mock-fb__bar">
					<div className="mock-fb__title">
						<strong>Appointment Reminder Flow</strong>
						<span>Overview workflow</span>
					</div>
					<div className="mock-fb__barctl">
						<IconButton
							icon={<Play />}
							label="Run flow"
							variant={run === "running" ? "secondary" : "ghost"}
							size="sm"
							onClick={startRun}
						/>
						<IconButton
							icon={<Settings2 />}
							label="Flow settings"
							variant="ghost"
							size="sm"
						/>
					</div>
				</header>

				<div className="mock-fb__stage" ref={stageRef}>
					<div
						className="mock-fb__zoomer"
						style={{ transform: `scale(${ZOOMS[zoom]})` }}
					>
						<svg
							className="mock-fb__edges"
							width="620"
							height="800"
							aria-hidden="true"
						>
							{EDGES.map((e, i) => (
								<g key={i} className={run === "running" ? "is-live" : ""}>
									<line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
									<circle cx={e.x1} cy={e.y1} r="3.5" />
									<circle cx={e.x2} cy={e.y2} r="3.5" />
									{e.label ? (
										<>
											<rect
												x={(e.x1 + e.x2) / 2 - 24}
												y={(e.y1 + e.y2) / 2 - 10}
												width="48"
												height="20"
												rx="10"
											/>
											<text x={(e.x1 + e.x2) / 2} y={(e.y1 + e.y2) / 2 + 3.5}>
												{e.label}
											</text>
										</>
									) : null}
								</g>
							))}
						</svg>
						{NODES.map((n) => (
							<button
								className={
									"mock-fb__node" +
									(selected === n.id ? " is-selected" : "") +
									(run === "running" ? " is-live" : "") +
									(run === "done" ? " is-done" : "")
								}
								style={{ left: n.x, top: n.y, width: n.w }}
								key={n.id}
								onClick={() => setSelected(selected === n.id ? null : n.id)}
							>
								<span className="mock-fb__nhead">
									<n.icon aria-hidden="true" />
									<span className="mock-fb__ntitle">
										<strong>{n.title}</strong>
										<em>{n.desc}</em>
									</span>
									<span
										className={`mock-fb__nkind mock-fb__nkind--${n.kind.toLowerCase()}`}
									>
										{n.kind}
									</span>
								</span>
								{n.rows.map((r) => (
									<span className="mock-fb__nrow" key={r[0]}>
										<span>{r[0]}</span>
										<span>{r[1]}</span>
									</span>
								))}
								{n.code ? (
									<span className="mock-fb__ncode">
										{n.code.map((l, i) => (
											<span key={i}>{l}</span>
										))}
									</span>
								) : null}
								{n.output
									? n.output.map((r) => (
											<span
												className="mock-fb__nrow mock-fb__nrow--out"
												key={r[0]}
											>
												<span>{r[0]}</span>
												<span>{r[1]}</span>
											</span>
										))
									: null}
							</button>
						))}
					</div>

					{/* zoom bar */}
					<div className="mock-fb__zoom">
						<IconButton
							icon={<Minus />}
							label="Zoom out"
							variant="ghost"
							size="sm"
							onClick={() => setZoom((z) => Math.max(0, z - 1))}
							disabled={zoom === 0}
						/>
						<span>{Math.round(ZOOMS[zoom] * 100)}%</span>
						<IconButton
							icon={<Plus />}
							label="Zoom in"
							variant="ghost"
							size="sm"
							onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
							disabled={zoom === ZOOMS.length - 1}
						/>
					</div>
				</div>
			</main>

			{/* inspector */}
			<aside className="mock-fb__insp">
				<header className="mock-fb__insphead">
					<h3>{selNode ? "Node" : "Flow"}</h3>
					<span
						className={
							run === "running"
								? "mock-fb__status is-running"
								: "mock-fb__status"
						}
					>
						{run === "running" ? "Running…" : "Active"}
					</span>
				</header>

				{selNode ? (
					<section className="mock-fb__panel">
						<h4>Selected node</h4>
						<div className="mock-fb__selnode">
							<selNode.icon aria-hidden="true" />
							<strong>{selNode.title}</strong>
							<span
								className={`mock-fb__nkind mock-fb__nkind--${selNode.kind.toLowerCase()}`}
							>
								{selNode.kind}
							</span>
						</div>
						<dl className="mock-fb__props">
							{selNode.rows.slice(0, 3).map((r) => (
								<div key={r[0]}>
									<dt>{r[0]}</dt>
									<dd>{r[1]}</dd>
								</div>
							))}
						</dl>
					</section>
				) : null}

				<section className="mock-fb__panel">
					<h4>Properties</h4>
					<dl className="mock-fb__props">
						<div>
							<dt>Type</dt>
							<dd>Workflow</dd>
						</div>
						<div>
							<dt>Status</dt>
							<dd>{run === "done" ? "Last run · success" : "Enabled"}</dd>
						</div>
						<div>
							<dt>Created</dt>
							<dd>Nov 4, 2024</dd>
						</div>
						<div>
							<dt>Updated</dt>
							<dd>Mar 10, 2025</dd>
						</div>
						<div>
							<dt>Version</dt>
							<dd>v1.2.0</dd>
						</div>
					</dl>
				</section>

				<section className="mock-fb__panel">
					<h4>Runtime settings</h4>
					<dl className="mock-fb__props">
						<div>
							<dt>Auto-run on schedule</dt>
							<dd>
								<span className="mock-fb__on">On</span>
							</dd>
						</div>
						<div>
							<dt>Timeout</dt>
							<dd>30 s</dd>
						</div>
						<div>
							<dt>Retry attempts</dt>
							<dd>2</dd>
						</div>
						<div>
							<dt>Stop on error</dt>
							<dd>
								<span className="mock-fb__on">On</span>
							</dd>
						</div>
					</dl>
				</section>

				<section className="mock-fb__panel">
					<h4>Variables</h4>
					<dl className="mock-fb__props mock-fb__props--mono">
						<div>
							<dt>clinic_phone</dt>
							<dd>"+91 98…"</dd>
						</div>
						<div>
							<dt>sms_sender</dt>
							<dd>"CITYCLN"</dd>
						</div>
					</dl>
				</section>

				<div className="mock-fb__actions">
					<Button variant="primary" size="sm" onClick={() => setRun("done")}>
						Save change
					</Button>
					<Button variant="secondary" size="sm">
						Duplicate flow
					</Button>
					<IconButton
						icon={<Trash2 />}
						label="Delete flow"
						variant="ghost"
						size="sm"
					/>
				</div>
			</aside>
		</div>
	);
}
