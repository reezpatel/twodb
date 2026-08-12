import type {} from "styled-jsx";
import type { ReactNode } from "react";
import { Tooltip } from "./Tooltip";
import { navRailStyles } from "./NavRail.style";

export interface NavRailItem {
	id: string;
	icon: ReactNode;
	label: string;
}

export interface NavRailProps {
	items: NavRailItem[];
	value: string;
	onValueChange: (id: string) => void;
	/** Slot above the items — e.g. a compact brand mark. */
	header?: ReactNode;
	/** Slot pinned below the items — e.g. a phase toggle. */
	footer?: ReactNode;
	"aria-label"?: string;
}

export function NavRail({
	items,
	value,
	onValueChange,
	header,
	footer,
	"aria-label": ariaLabel = "Primary",
}: NavRailProps) {
	return (
		<nav className="tw-rail" data-phase="night" aria-label={ariaLabel}>
			<style jsx>{navRailStyles}</style>
			{header}
			{items.map((item) => (
				<Tooltip key={item.id} tip={item.label} side="right">
					<button
						type="button"
						className={
							item.id === value
								? "tw-rail__item tw-rail__item--active"
								: "tw-rail__item"
						}
						aria-label={item.label}
						aria-current={item.id === value ? "page" : undefined}
						onClick={() => onValueChange(item.id)}
					>
						{item.icon}
					</button>
				</Tooltip>
			))}
			{footer ? (
				<>
					<span className="tw-rail__spacer" />
					{footer}
				</>
			) : null}
		</nav>
	);
}
