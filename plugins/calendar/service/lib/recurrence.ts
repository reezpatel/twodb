import { rrulestr } from "rrule/dist/esm/index.js";

export interface OccurrenceInput {
	start_at: Date;
	end_at: Date;
	rrule: string | null;
	exdates: string[];
}

export interface Occurrence {
	start: Date;
	end: Date;
	recurring: boolean;
}

/** Throws when the RRULE string cannot be parsed. */
export function assertValidRrule(rrule: string): void {
	rrulestr(normalize(rrule));
}

function normalize(rrule: string): string {
	const trimmed = rrule.trim();
	return trimmed.toUpperCase().startsWith("RRULE:")
		? trimmed
		: `RRULE:${trimmed}`;
}

/**
 * Expand an event into its concrete occurrences overlapping [rangeStart,
 * rangeEnd]. One-off events yield at most one occurrence; recurring series
 * yield one per occurrence, minus exdates.
 */
export function expandOccurrences(
	event: OccurrenceInput,
	rangeStart: Date,
	rangeEnd: Date,
): Occurrence[] {
	const durationMs = event.end_at.getTime() - event.start_at.getTime();
	const exdateMs = new Set(
		event.exdates.flatMap((d) => {
			const ms = new Date(d).getTime();
			return Number.isFinite(ms) ? [ms] : [];
		}),
	);

	if (!event.rrule) {
		if (event.end_at <= rangeStart || event.start_at >= rangeEnd) return [];
		if (exdateMs.has(event.start_at.getTime())) return [];
		return [{ start: event.start_at, end: event.end_at, recurring: false }];
	}

	let rule;
	try {
		rule = rrulestr(normalize(event.rrule), { dtstart: event.start_at });
	} catch {
		return [];
	}

	// Occurrences are matched on start; widen the window by the event
	// duration so long events starting before the range still overlap.
	const windowStart = new Date(rangeStart.getTime() - Math.max(durationMs, 0));

	return rule
		.between(windowStart, rangeEnd, true)
		.filter((start) => !exdateMs.has(start.getTime()))
		.map((start) => ({
			start,
			end: new Date(start.getTime() + durationMs),
			recurring: true,
		}))
		.filter((occ) => occ.end > rangeStart && occ.start < rangeEnd);
}
