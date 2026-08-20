import { chartStyles } from "./chart.style";
export interface ScoreRingProps {
	/** 0–100; negative values render in the danger tone. */
	value: number;
	size?: number;
	stroke?: number;
	label?: string;
}

export function ScoreRing({
	value,
	size = 36,
	stroke = 3.5,
	label,
}: ScoreRingProps) {
	const r = (size - stroke) / 2;
	const c = 2 * Math.PI * r;
	const frac = Math.min(100, Math.abs(value)) / 100;
	const danger = value < 0;

	return (
		<svg
			className={["tw-ring", danger ? "tw-ring--danger" : ""]
				.filter(Boolean)
				.join(" ")}
			width={size}
			height={size}
			role="img"
			aria-label={label ?? `Score ${value} of 100`}
		>
			<style jsx>{chartStyles}</style>
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
	);
}
