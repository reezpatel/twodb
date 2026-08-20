import type { ReactNode } from "react";
import { useId } from "react";
import { segmentedStyles } from "./segmented.style";

export interface SegmentedItem {
	id: string;
	label: string;
	icon?: ReactNode;
	/** Optional muted count riding after the label (e.g. "View all  10"). */
	count?: number;
}

export interface SegmentedProps {
	items: SegmentedItem[];
	value: string;
	onValueChange: (id: string) => void;
	"aria-label": string;
	/** Stretch to fill — when true, each button takes equal width. */
	full?: boolean;
	/** Show only icons while preserving each item label for accessibility. */
	iconOnly?: boolean;
}

/**
 * Segmented control — a contained, pill-on-band toggle.
 * The active button lights up as a white pill lifted off the band;
 * others stay quietly neutral. Use for in-place mode switches
 * (Share / Publish / Export, Day / Week / Month, etc.) where
 * the choice is short and mutually exclusive.
 */
export function Segmented({
	items,
	value,
	onValueChange,
	"aria-label": ariaLabel,
	full,
	iconOnly,
}: SegmentedProps) {
	const id = useId();
	const classes = [
		"tw-seg",
		full ? "tw-seg--full" : "",
		iconOnly ? "tw-seg--icon-only" : "",
	]
		.filter(Boolean)
		.join(" ");
	return (
		<div className={classes} role="tablist" aria-label={ariaLabel}>
			<style jsx>{segmentedStyles}</style>
			{items.map((item) => {
				const active = item.id === value;
				return (
					<button
						key={item.id}
						id={`${id}-${item.id}`}
						role="tab"
						type="button"
						aria-selected={active}
						aria-controls={`${id}-panel`}
						className={
							active ? "tw-seg__btn tw-seg__btn--active" : "tw-seg__btn"
						}
						onClick={() => onValueChange(item.id)}
					>
						{item.icon && <span className="tw-seg__icon">{item.icon}</span>}
						<span className="tw-seg__label">{item.label}</span>
						{item.count != null && (
							<span className="tw-seg__count">{item.count}</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
