import { useState } from "react";
import { ChevronUp } from "lucide-react";
import { usageStatsStyles } from "./usage-stats.style";

interface UsageWindow {
	label: string;
	/** 0–100 percent of the window consumed. */
	used: number;
	resets: string;
}

interface UsageProvider {
	id: string;
	name: string;
	current?: boolean;
	windows: UsageWindow[];
}

const PROVIDERS: UsageProvider[] = [
	{
		id: "anthropic",
		name: "Anthropic",
		current: true,
		windows: [
			{ label: "5h", used: 42, resets: "15:00" },
			{ label: "week", used: 61, resets: "Mon" },
			{ label: "month", used: 23, resets: "Jun 1" },
		],
	},
	{
		id: "glm",
		name: "GLM",
		windows: [
			{ label: "5h", used: 87, resets: "14:12" },
			{ label: "week", used: 54, resets: "Mon" },
			{ label: "month", used: 38, resets: "Jun 1" },
		],
	},
	{
		id: "kimi",
		name: "Kimi",
		windows: [
			{ label: "5h", used: 12, resets: "16:40" },
			{ label: "week", used: 30, resets: "Mon" },
			{ label: "month", used: 9, resets: "Jun 1" },
		],
	},
];

function tone(used: number): string {
	if (used >= 85) return "danger";
	if (used >= 60) return "warning";
	return "ok";
}

export function UsageStats() {
	const [open, setOpen] = useState(true);

	return (
		<div className="code-usage">
			<style jsx>{usageStatsStyles}</style>
			<button className="code-usage__header" onClick={() => setOpen(!open)}>
				<span className="code-usage__title">Usage</span>
				<span
					className="code-usage__toggle"
					style={{ transform: open ? "rotate(0deg)" : "rotate(180deg)" }}
				>
					<ChevronUp size={16} aria-hidden="true" />
				</span>
			</button>
			{open ? (
				<div className="code-usage__providers">
					{PROVIDERS.map((provider) => (
						<div key={provider.id} className="code-usage__provider">
							<div className="code-usage__provider-name">
								{provider.name}
								{provider.current ? (
									<span className="code-usage__current">current</span>
								) : null}
							</div>
							{provider.windows.map((window) => (
								<div key={window.label} className="code-usage__row">
									<span className="code-usage__window">{window.label}</span>
									<span className="code-usage__bar">
										<span
											className={`code-usage__fill code-usage__fill--${tone(window.used)}`}
											style={{ width: `${window.used}%` }}
										/>
									</span>
									<span className="code-usage__pct">{window.used}%</span>
									<span className="code-usage__reset">↻ {window.resets}</span>
								</div>
							))}
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}
