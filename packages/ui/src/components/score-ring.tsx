import { chartStyles } from "./chart.style";
import type { ReactNode } from "react";

export interface ScoreRingProps {
	/** 0–100; negative values render in the danger tone. */
	value: number;
	size?: number;
	stroke?: number;
	label?: string;
	/** arc tone; defaults to accent (danger when value is negative) */
	tone?: "accent" | "warning" | "danger";
	/** content centered inside the ring (e.g. the percentage figure) */
	children?: ReactNode;
}

export function ScoreRing({
	value,
	size = 36,
	stroke = 3.5,
	label,
	tone,
	children,
}: ScoreRingProps) {
	const r = (size - stroke) / 2;
	const c = 2 * Math.PI * r;
	const frac = Math.min(100, Math.abs(value)) / 100;
	const resolvedTone = tone ?? (value < 0 ? "danger" : "accent");

	return (
		<span className="tw-ring-wrap">
			<style jsx>{chartStyles}</style>
			<svg
				className={[
					"tw-ring",
					resolvedTone === "danger" ? "tw-ring--danger" : "",
					resolvedTone === "warning" ? "tw-ring--warning" : "",
				]
					.filter(Boolean)
					.join(" ")}
				width={size}
				height={size}
				role="img"
				aria-label={label ?? `Score ${value} of 100`}
			>
				<circle
					className="tw-ring__track"
					cx={size / 2}
					cy={size / 2}
					r={r}
					strokeWidth={stroke}
					fill="none"
				/>
				<circle
					className="tw-ring__arc"
					cx={size / 2}
					cy={size / 2}
					r={r}
					strokeWidth={stroke}
					strokeDasharray={`${c * frac} ${c}`}
					strokeLinecap="round"
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
					fill="none"
				/>
			</svg>
			{children ? (
				<span
					className="tw-ring__center"
					style={{ fontSize: Math.max(8, Math.round(size * 0.32)) }}
				>
					{children}
				</span>
			) : null}
		</span>
	);
}
