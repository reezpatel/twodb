import type { CSSProperties, ReactNode } from "react";
import { overlayStyles } from "./overlay.style";

export type TooltipSide = "top" | "right";

export interface TooltipProps {
	tip: string;
	side?: TooltipSide;
	/** ms of continuous hover before the tip appears (default 0). */
	delay?: number;
	children: ReactNode;
}

export function Tooltip({ tip, side = "top", delay, children }: TooltipProps) {
	const style = delay
		? ({ "--tip-delay": `${delay}ms` } as CSSProperties)
		: undefined;
	return (
		<span className={`tw-tip tw-tip--${side}`} data-tip={tip} style={style}>
			<style jsx>{overlayStyles}</style>
			{children}
		</span>
	);
}
