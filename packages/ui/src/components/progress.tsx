import { progressStyles } from "./progress.style";
export interface ProgressProps {
	/** 0 to 100 — clamped. */
	value: number;
	/** Optional max (defaults to 100). */
	max?: number;
	/** Optional accessible label. */
	"aria-label"?: string;
	/** Tone of the filled bar. */
	tone?: "accent" | "rose" | "purple" | "go" | "warning";
}

/**
 * Progress — a single horizontal bar that reads from left to right.
 * The rail is a hairline band; the fill takes the chosen tone.
 * Used for seat counters, completion meters, and any step-along signal.
 */
export function Progress({
	value,
	max = 100,
	"aria-label": ariaLabel,
	tone = "accent",
}: ProgressProps) {
	const pct = Math.max(0, Math.min(100, (value / max) * 100));
	const toneClass = tone === "accent" ? "" : `tw-progress__fill--${tone}`;
	return (
		<div
			className="tw-progress"
			role="progressbar"
			aria-valuenow={Math.round(pct)}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-label={ariaLabel}
		>
			<style jsx>{progressStyles}</style>
			<div
				className={`tw-progress__fill ${toneClass}`}
				style={{ width: `${pct}%` }}
			/>
		</div>
	);
}
