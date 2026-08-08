import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Badge, type BadgeTone } from "./Badge";

export interface DataGanttMeta {
	label: string;
	value: ReactNode;
	tone?: BadgeTone;
}

export interface DataGanttMilestone {
	date: string | Date;
	label: string;
	tone?: BadgeTone;
}

export interface DataGanttItem {
	id: string;
	title: string;
	kicker?: string;
	description?: ReactNode;
	start: string | Date;
	end: string | Date;
	progress?: number;
	status?: string;
	tone?: BadgeTone;
	owner?: string;
	meta?: DataGanttMeta[];
	milestones?: DataGanttMilestone[];
}

export interface DataGanttProps {
	items: DataGanttItem[];
	from?: string | Date;
	to?: string | Date;
	today?: string | Date;
	selectedId?: string;
	defaultSelectedId?: string;
	onSelectedIdChange?: (id: string) => void;
	renderDetail?: (item: DataGanttItem) => ReactNode;
	emptyMessage?: string;
	className?: string;
	"aria-label"?: string;
}

interface PreparedGanttItem {
	item: DataGanttItem;
	start: Date;
	end: Date;
}

interface TimelineWindow {
	start: Date;
	end: Date;
	totalDays: number;
}

const DAY_MS = 86_400_000;
const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
});

function toDay(value: string | Date): Date {
	if (value instanceof Date) {
		return new Date(value.getFullYear(), value.getMonth(), value.getDate());
	}

	const [datePart] = value.split("T");
	const [year, month, day] = datePart.split("-").map(Number);
	if (year && month && day) return new Date(year, month - 1, day);

	const parsed = new Date(value);
	return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

function diffDays(start: Date, end: Date): number {
	return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function formatRange(start: Date, end: Date): string {
	return `${shortDateFormatter.format(start)} → ${shortDateFormatter.format(end)}`;
}

function asPct(value: number): string {
	return `${value}%`;
}

function getOffsetPercent(
	window: TimelineWindow,
	date: Date,
	middleOfDay = false,
): number {
	const offset = diffDays(window.start, date) + (middleOfDay ? 0.5 : 0);
	return (offset / window.totalDays) * 100;
}

function buildTicks(start: Date, end: Date): Date[] {
	const totalDays = Math.max(1, diffDays(start, end) + 1);
	const targetTicks = totalDays > 45 ? 6 : totalDays > 24 ? 5 : 4;
	const step = Math.max(1, Math.ceil(totalDays / targetTicks));
	const ticks: Date[] = [];

	for (let offset = 0; offset < totalDays; offset += step) {
		ticks.push(addDays(start, offset));
	}

	if (diffDays(ticks[ticks.length - 1], end) > Math.max(2, step / 2)) {
		ticks.push(end);
	}

	return ticks;
}

function prepareItems(items: DataGanttItem[]): PreparedGanttItem[] {
	return items.map((item) => {
		const start = toDay(item.start);
		const end = toDay(item.end);
		return { item, start, end: end < start ? start : end };
	});
}

function getWindow(
	prepared: PreparedGanttItem[],
	today: string | Date | undefined,
	from: string | Date | undefined,
	to: string | Date | undefined,
): TimelineWindow {
	if (prepared.length === 0) {
		const base = toDay(today ?? new Date());
		return { start: base, end: addDays(base, 14), totalDays: 15 };
	}

	const minStart = prepared.reduce(
		(min, row) => (row.start < min ? row.start : min),
		prepared[0].start,
	);
	const maxEnd = prepared.reduce(
		(max, row) => (row.end > max ? row.end : max),
		prepared[0].end,
	);
	const rawStart = from ? toDay(from) : minStart;
	const rawEnd = to ? toDay(to) : maxEnd;
	const start = rawEnd < rawStart ? rawEnd : rawStart;
	const end = rawEnd < rawStart ? rawStart : rawEnd;

	return { start, end, totalDays: Math.max(1, diffDays(start, end) + 1) };
}

function DataGanttToolbar({ window }: { window: TimelineWindow }) {
	return (
		<div className="tw-gantt__toolbar">
			<div>
				<span className="tw-cue">Data to details</span>
				<h3 className="tw-gantt__title">Timeline</h3>
			</div>
			<span className="tw-gantt__range tw-tnum">
				{formatRange(window.start, window.end)}
			</span>
		</div>
	);
}

function TimelineHead({
	ticks,
	todayPosition,
	window,
}: {
	ticks: Date[];
	todayPosition?: number;
	window: TimelineWindow;
}) {
	return (
		<div className="tw-gantt__head tw-gantt__head--timeline">
			{ticks.map((tick) => (
				<span
					key={tick.toISOString()}
					style={{ left: asPct(getOffsetPercent(window, tick)) }}
				>
					{shortDateFormatter.format(tick)}
				</span>
			))}
			{todayPosition !== undefined ? (
				<span
					className="tw-gantt__today-label"
					style={{ left: asPct(todayPosition) }}
				>
					Today
				</span>
			) : null}
		</div>
	);
}

function RecordRows({
	rows,
	activeId,
	onSelect,
}: {
	rows: PreparedGanttItem[];
	activeId: string;
	onSelect: (id: string) => void;
}) {
	return (
		<div className="tw-gantt__rows" role="list" aria-label="Timeline records">
			{rows.map(({ item }) => {
				const isActive = item.id === activeId;
				return (
					<button
						type="button"
						key={item.id}
						className={`tw-gantt__record${isActive ? " tw-gantt__record--active" : ""}`}
						onClick={() => onSelect(item.id)}
						aria-pressed={isActive}
					>
						<span>
							{item.kicker ? (
								<span className="tw-gantt__kicker">{item.kicker}</span>
							) : null}
							<strong>{item.title}</strong>
						</span>
						<span className="tw-gantt__record-meta">
							{item.status ? (
								<Badge tone={item.tone ?? "neutral"}>{item.status}</Badge>
							) : null}
							{item.owner ? <span>{item.owner}</span> : null}
						</span>
					</button>
				);
			})}
		</div>
	);
}

function getBarStyle(
	row: PreparedGanttItem,
	window: TimelineWindow,
): CSSProperties {
	const rawStart = diffDays(window.start, row.start);
	const rawEnd = diffDays(window.start, row.end) + 1;
	const barStart = clamp(rawStart, 0, window.totalDays);
	const barEnd = clamp(rawEnd, 0, window.totalDays);
	const left = (barStart / window.totalDays) * 100;
	const width = Math.max(2, ((barEnd - barStart) / window.totalDays) * 100);

	return { left: asPct(left), width: asPct(width) };
}

function TimelineTracks({
	rows,
	activeId,
	todayPosition,
	window,
}: {
	rows: PreparedGanttItem[];
	activeId: string;
	todayPosition?: number;
	window: TimelineWindow;
}) {
	return (
		<div className="tw-gantt__tracks" aria-hidden="true">
			{todayPosition !== undefined ? (
				<span
					className="tw-gantt__today"
					style={{ left: asPct(todayPosition) }}
				/>
			) : null}
			{rows.map((row) => (
				<TimelineTrack
					key={row.item.id}
					row={row}
					activeId={activeId}
					window={window}
				/>
			))}
		</div>
	);
}

function TimelineTrack({
	row,
	activeId,
	window,
}: {
	row: PreparedGanttItem;
	activeId: string;
	window: TimelineWindow;
}) {
	const { item } = row;
	const progress = clamp(item.progress ?? 0, 0, 100) / 100;

	return (
		<div className="tw-gantt__track">
			<span
				className={`tw-gantt__bar tw-gantt__bar--${item.tone ?? "neutral"}${
					item.id === activeId ? " tw-gantt__bar--active" : ""
				}`}
				style={getBarStyle(row, window)}
			>
				<span style={{ transform: `scaleX(${progress})` }} />
			</span>
			{(item.milestones ?? []).map((milestone) => (
				<TimelineMilestone
					key={`${item.id}-${milestone.label}`}
					item={item}
					milestone={milestone}
					window={window}
				/>
			))}
		</div>
	);
}

function TimelineMilestone({
	item,
	milestone,
	window,
}: {
	item: DataGanttItem;
	milestone: DataGanttMilestone;
	window: TimelineWindow;
}) {
	const markerLeft = getOffsetPercent(window, toDay(milestone.date), true);
	if (markerLeft < 0 || markerLeft > 100) return null;

	return (
		<span
			className={`tw-gantt__milestone tw-gantt__milestone--${milestone.tone ?? item.tone ?? "neutral"}`}
			style={{ left: asPct(markerLeft) }}
			title={milestone.label}
		/>
	);
}

function DefaultGanttDetail({ item }: { item: DataGanttItem }) {
	return (
		<>
			<div className="tw-gantt__detail-head">
				<div>
					{item.kicker ? <span className="tw-cue">{item.kicker}</span> : null}
					<h4>{item.title}</h4>
				</div>
				{item.status ? (
					<Badge tone={item.tone ?? "neutral"}>{item.status}</Badge>
				) : null}
			</div>
			{item.description ? (
				<div className="tw-gantt__detail-copy">{item.description}</div>
			) : null}
			<dl className="tw-gantt__facts">
				<div>
					<dt>Window</dt>
					<dd>{formatRange(toDay(item.start), toDay(item.end))}</dd>
				</div>
				{item.owner ? (
					<div>
						<dt>Owner</dt>
						<dd>{item.owner}</dd>
					</div>
				) : null}
				{item.meta?.map((fact) => (
					<div key={fact.label}>
						<dt>{fact.label}</dt>
						<dd>
							{fact.tone ? (
								<Badge tone={fact.tone}>{fact.value}</Badge>
							) : (
								fact.value
							)}
						</dd>
					</div>
				))}
			</dl>
		</>
	);
}

export function DataGantt({
	items,
	from,
	to,
	today,
	selectedId,
	defaultSelectedId,
	onSelectedIdChange,
	renderDetail,
	emptyMessage = "No timeline items yet.",
	className = "",
	"aria-label": ariaLabel = "Data timeline",
}: DataGanttProps) {
	const [internalSelectedId, setInternalSelectedId] = useState(
		defaultSelectedId ?? items[0]?.id ?? "",
	);
	const rows = useMemo(() => prepareItems(items), [items]);
	const window = useMemo(
		() => getWindow(rows, today, from, to),
		[from, rows, to, today],
	);
	const ticks = useMemo(
		() => buildTicks(window.start, window.end),
		[window.end, window.start],
	);
	const activeId = selectedId ?? internalSelectedId;
	const active = items.find((item) => item.id === activeId) ?? items[0];
	const todayPosition = today
		? getOffsetPercent(window, toDay(today), true)
		: undefined;
	const visibleToday =
		todayPosition !== undefined && todayPosition >= 0 && todayPosition <= 100
			? todayPosition
			: undefined;
	const classes = ["tw-gantt", className].filter(Boolean).join(" ");

	function selectItem(id: string) {
		setInternalSelectedId(id);
		onSelectedIdChange?.(id);
	}

	if (items.length === 0) {
		return (
			<div className={classes} aria-label={ariaLabel}>
				<div className="tw-gantt__empty">{emptyMessage}</div>
			</div>
		);
	}

	return (
		<section className={classes} aria-label={ariaLabel}>
			<DataGanttToolbar window={window} />

			<div className="tw-gantt__grid">
				<div className="tw-gantt__head tw-gantt__head--data">Record</div>
				<TimelineHead
					ticks={ticks}
					todayPosition={visibleToday}
					window={window}
				/>
				<RecordRows rows={rows} activeId={active.id} onSelect={selectItem} />
				<TimelineTracks
					rows={rows}
					activeId={active.id}
					todayPosition={visibleToday}
					window={window}
				/>
			</div>

			<div className="tw-gantt__detail">
				{renderDetail ? (
					renderDetail(active)
				) : (
					<DefaultGanttDetail item={active} />
				)}
			</div>
		</section>
	);
}
