import { useMemo } from "react";

export interface TimelineSegment {
	label: string;
	/** Minutes from midnight. */
	start: number;
	end: number;
	/** Optional color override; defaults cycle the horizon palette. */
	tone?: string;
}

export interface DayTimelineProps {
	segments: TimelineSegment[];
	/** Axis bounds, hours from midnight. Defaults fit the segments. */
	startHour?: number;
	endHour?: number;
	/** Axis tick labels every N hours. */
	tickEvery?: number;
	title?: string;
	dateLabel?: string;
	tracking?: boolean;
}

const TONES = [
	"var(--twdb-cobalt)",
	"var(--twdb-rose)",
	"var(--twdb-rose-light)",
	"var(--twdb-dawn)",
];

function fmtHour(h: number): string {
	const period = h >= 12 ? "PM" : "AM";
	const hr = h % 12 === 0 ? 12 : h % 12;
	return `${String(hr).padStart(2, "0")}:00 ${period}`;
}

export function DayTimeline({
	segments,
	startHour,
	endHour,
	tickEvery = 2,
	title,
	dateLabel,
	tracking,
}: DayTimelineProps) {
	const { from, ticks, total } = useMemo(() => {
		const minStart = Math.min(...segments.map((s) => s.start));
		const maxEnd = Math.max(...segments.map((s) => s.end));
		const fromMin = (startHour ?? Math.floor(minStart / 60)) * 60;
		const toMin = (endHour ?? Math.ceil(maxEnd / 60)) * 60;
		const ticksArr: number[] = [];
		for (let h = fromMin / 60; h <= toMin / 60; h += tickEvery)
			ticksArr.push(h);
		return { from: fromMin, ticks: ticksArr, total: toMin - fromMin };
	}, [segments, startHour, endHour, tickEvery]);

	const tracked = segments.reduce((sum, s) => sum + (s.end - s.start), 0);

	return (
		<div className="tw-dayline">
			{title || dateLabel || tracking !== undefined ? (
				<div className="tw-dayline__head">
					<span className="tw-dayline__title">
						{title ? <strong>{title}</strong> : null}
						{dateLabel ? (
							<span className="tw-dayline__date tw-tnum">{dateLabel}</span>
						) : null}
					</span>
					{tracking !== undefined ? (
						<span className="tw-dayline__tracking">
							Tracking:
							<i
								className={
									tracking
										? "tw-dayline__dot tw-dayline__dot--on"
										: "tw-dayline__dot"
								}
							/>
							{tracking ? "Active" : "Paused"}
						</span>
					) : null}
				</div>
			) : null}

			<div
				className="tw-dayline__bar"
				role="img"
				aria-label={segments
					.map(
						(s) => `${s.label} ${fmtHour(s.start / 60)}–${fmtHour(s.end / 60)}`,
					)
					.join(", ")}
			>
				{segments.map((s, i) => {
					const left = ((s.start - from) / total) * 100;
					const width = ((s.end - s.start) / total) * 100;
					return (
						<span
							key={s.label + s.start}
							className="tw-dayline__seg"
							style={{
								left: `${left}%`,
								width: `${width}%`,
								background: s.tone ?? TONES[i % TONES.length],
							}}
						/>
					);
				})}
			</div>

			<div className="tw-dayline__axis tw-tnum">
				{ticks.map((h) => (
					<span key={h} style={{ left: `${((h * 60 - from) / total) * 100}%` }}>
						{fmtHour(h)}
					</span>
				))}
			</div>

			<div className="tw-dayline__legend">
				{segments.map((s, i) => {
					const pct = Math.round(((s.end - s.start) / tracked) * 100);
					return (
						<span key={s.label} className="tw-dayline__legend-item">
							<i style={{ background: s.tone ?? TONES[i % TONES.length] }} />
							<b className="tw-tnum">{pct}%</b> {s.label}
						</span>
					);
				})}
			</div>
		</div>
	);
}
