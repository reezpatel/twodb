import { useMemo } from "react";

export type CalTone = "cobalt" | "rose" | "warning" | "danger" | "neutral";

export interface MonthEvent {
	id: string;
	/** ISO date, yyyy-mm-dd */
	date: string;
	title: string;
	time?: string;
	tone?: CalTone;
}

export interface MonthCalendarProps {
	/** Any date inside the month to display. */
	month: Date;
	events: MonthEvent[];
	/** Which day gets the "today" ring — defaults to the real today. */
	today?: Date;
	weekStartsOn?: 0 | 1;
	/** Chips per cell before collapsing into "+N more". */
	maxVisible?: number;
	onSelectDay?: (date: Date) => void;
	onSelectEvent?: (event: MonthEvent) => void;
}

const WEEKDAYS_1 = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_0 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function iso(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MonthCalendar({
	month,
	events,
	today,
	weekStartsOn = 1,
	maxVisible = 3,
	onSelectDay,
	onSelectEvent,
}: MonthCalendarProps) {
	const todayIso = iso(today ?? new Date());
	const monthIndex = month.getMonth();

	const byDay = useMemo(() => {
		const map = new Map<string, MonthEvent[]>();
		for (const e of events) {
			const list = map.get(e.date) ?? [];
			list.push(e);
			map.set(e.date, list);
		}
		return map;
	}, [events]);

	const days = useMemo(() => {
		const first = new Date(month.getFullYear(), month.getMonth(), 1);
		const dow = (first.getDay() - weekStartsOn + 7) % 7;
		const start = new Date(first);
		start.setDate(first.getDate() - dow);
		return Array.from({ length: 42 }, (_, i) => {
			const d = new Date(start);
			d.setDate(start.getDate() + i);
			return d;
		});
	}, [month, weekStartsOn]);

	const weekdays = weekStartsOn === 1 ? WEEKDAYS_1 : WEEKDAYS_0;

	return (
		<div className="tw-mcal">
			<div className="tw-mcal__weekdays">
				{weekdays.map((d) => (
					<span key={d} className="tw-cue">
						{d}
					</span>
				))}
			</div>
			<div className="tw-mcal__grid">
				{days.map((day) => {
					const key = iso(day);
					const dayEvents = byDay.get(key) ?? [];
					const visible = dayEvents.slice(0, maxVisible);
					const extra = dayEvents.length - visible.length;
					const outside = day.getMonth() !== monthIndex;
					const isToday = key === todayIso;
					return (
						<div
							key={key}
							className={[
								"tw-mcal__day",
								outside ? "tw-mcal__day--outside" : "",
								isToday ? "tw-mcal__day--today" : "",
								onSelectDay ? "tw-mcal__day--click" : "",
							]
								.filter(Boolean)
								.join(" ")}
							onClick={() => onSelectDay?.(day)}
						>
							<span className="tw-mcal__num tw-tnum">
								{isToday ? <b>{day.getDate()}</b> : day.getDate()}
							</span>
							<div className="tw-mcal__events">
								{visible.map((e) => (
									<button
										key={e.id}
										type="button"
										className={`tw-mcal__ev tw-mcal__ev--${e.tone ?? "cobalt"}`}
										onClick={(ev) => {
											ev.stopPropagation();
											onSelectEvent?.(e);
										}}
									>
										<span className="tw-mcal__ev-title">{e.title}</span>
										{e.time ? (
											<span className="tw-mcal__ev-time tw-tnum">{e.time}</span>
										) : null}
									</button>
								))}
								{extra > 0 ? (
									<span className="tw-mcal__more">+{extra} more…</span>
								) : null}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
