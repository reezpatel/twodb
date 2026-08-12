import {
	BookOpen,
	GitCommit,
	History,
	MessageSquare,
	Sparkles,
} from "lucide-react";
import { codeSceneStyles } from "./CodeScene.style.jsx";
import type { Issue } from "./CodeScene";

const TABS = [
	{ id: "issue", label: "Issue", icon: BookOpen },
	{ id: "session", label: "Session", icon: MessageSquare, active: true },
	{ id: "history", label: "History", icon: History },
	{ id: "changes", label: "Changes", icon: GitCommit },
];

export function CodeMain({ issue }: { issue: Issue | undefined }) {
	return (
		<main className="mock-ai-editor__main">
			<style jsx>{codeSceneStyles}</style>
			<div className="mock-ai-editor__tabs">
				{TABS.map((tab) => (
					<button
						key={tab.id}
						className={`mock-ai-editor__tab${tab.active ? " is-active" : ""}`}
					>
						<tab.icon size={14} aria-hidden="true" />
						{tab.label}
					</button>
				))}
			</div>

			<div className="mock-ai-editor__content-header">
				<h1 className="mock-ai-editor__content-title">
					{issue?.title ?? "Select an issue"}
				</h1>
			</div>

			<div className="mock-ai-editor__empty">
				<div className="mock-ai-editor__empty-icon">
					<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
						<rect
							x="12"
							y="24"
							width="24"
							height="24"
							rx="2"
							transform="rotate(-45 12 24)"
							stroke="currentColor"
							strokeWidth="2"
						/>
						<rect
							x="12"
							y="24"
							width="16"
							height="16"
							rx="1"
							transform="rotate(-45 12 24)"
							fill="currentColor"
							fillOpacity="0.2"
						/>
					</svg>
				</div>
				<h2 className="mock-ai-editor__empty-title">Ready to get started?</h2>
				<p className="mock-ai-editor__empty-subtitle">
					#{issue?.number} {issue?.title}
				</p>
				<button className="mock-ai-editor__start-btn">
					<Sparkles size={18} aria-hidden="true" />
					Start in plan mode
				</button>
			</div>
		</main>
	);
}
