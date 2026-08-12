import { useState } from "react";
import {
	FileText,
	GitBranch,
	Layers,
	MessageSquare,
	Settings,
	Wand2,
} from "lucide-react";
import { codeSceneStyles } from "./CodeScene.style.jsx";
import { CodeMain } from "./CodeMain";
import { CodePanel } from "./CodePanel";
import { CodeSidebar } from "./CodeSidebar";

export type IssueStatus = "open" | "progress" | "done";
export type IssueType = "feature" | "bug" | null;

export interface Issue {
	id: string;
	number: number;
	title: string;
	status: IssueStatus;
	type: IssueType;
	section: "backlog" | "planning" | "done";
}

export const ISSUES: Issue[] = [
	{
		id: "1",
		number: 742,
		title: "Add dark mode",
		status: "open",
		type: null,
		section: "backlog",
	},
	{
		id: "2",
		number: 743,
		title: "Add user authentication",
		status: "open",
		type: "feature",
		section: "backlog",
	},
	{
		id: "3",
		number: 737,
		title: "Fix server crash on corrupt...",
		status: "progress",
		type: "bug",
		section: "planning",
	},
	{
		id: "4",
		number: 739,
		title: "Set up CLI pipeline",
		status: "done",
		type: null,
		section: "done",
	},
	{
		id: "5",
		number: 734,
		title: "Set up git and repo",
		status: "done",
		type: "feature",
		section: "done",
	},
];

const RAIL_ITEMS = [
	{ id: "files", icon: FileText },
	{ id: "issues", icon: MessageSquare },
	{ id: "ai", icon: Wand2 },
	{ id: "settings", icon: Settings },
];

const RAIL_BOTTOM = [
	{ id: "git", icon: GitBranch },
	{ id: "layers", icon: Layers },
];

export function CodeScene() {
	const [rail, setRail] = useState("issues");
	const [selectedId, setSelectedId] = useState("2");
	const issue = ISSUES.find((i) => i.id === selectedId);

	return (
		<div className="mock-ai-editor">
			<style jsx>{codeSceneStyles}</style>
			<nav className="mock-ai-editor__rail" aria-label="Code tools">
				{RAIL_ITEMS.map((item) => (
					<button
						key={item.id}
						className={`mock-ai-editor__rail-item${rail === item.id ? " is-active" : ""}`}
						onClick={() => setRail(item.id)}
						aria-label={item.id}
						aria-pressed={rail === item.id}
					>
						<item.icon size={18} aria-hidden="true" />
					</button>
				))}
				<div className="mock-ai-editor__rail-spacer" />
				{RAIL_BOTTOM.map((item) => (
					<button
						key={item.id}
						className="mock-ai-editor__rail-item"
						aria-label={item.id}
					>
						<item.icon size={18} aria-hidden="true" />
					</button>
				))}
			</nav>
			<CodeSidebar
				issues={ISSUES}
				selectedId={selectedId}
				onSelect={setSelectedId}
			/>
			<CodeMain issue={issue} />
			<CodePanel />
		</div>
	);
}
