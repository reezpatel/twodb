import { useState } from "react";
import { Dialog, Switch, Tabs } from "@twodb/ui";
import { FileText, Trash2 } from "lucide-react";
import { manageDialogStyles } from "./manage-dialog.style";

const SKILLS = [
	{
		id: "commit-pr",
		name: "commit-pr",
		desc: "Stage, commit and open a PR with a clean message.",
		on: true,
	},
	{
		id: "write-tests",
		name: "write-tests",
		desc: "Generate vitest coverage for touched files.",
		on: true,
	},
	{
		id: "safe-refactor",
		name: "safe-refactor",
		desc: "Rename and move symbols with import fixups.",
		on: false,
	},
];

const TOOLS = [
	{
		id: "terminal",
		name: "Terminal",
		desc: "Run shell commands in the workspace.",
		on: true,
	},
	{
		id: "file-edit",
		name: "File edit",
		desc: "Create and modify files.",
		on: true,
	},
	{
		id: "web-search",
		name: "Web search",
		desc: "Look up docs and references online.",
		on: true,
	},
	{
		id: "browser",
		name: "Browser",
		desc: "Drive a headless browser for UI checks.",
		on: false,
	},
];

const DOCS = [
	{ id: "agents", name: "AGENTS.md", meta: "4.2 kB" },
	{ id: "design", name: "DESIGN.md", meta: "11.8 kB" },
	{ id: "plan", name: "plan.md", meta: "7.1 kB" },
];

export function ManageDialog({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const [tab, setTab] = useState("skills");

	return (
		<Dialog open={open} onClose={onClose} title="Skills & tools">
			<style jsx>{manageDialogStyles}</style>
			<div className="code-manage__tabs">
				<Tabs
					aria-label="Manage"
					items={[
						{ id: "skills", label: "Skills" },
						{ id: "tools", label: "Tools" },
						{ id: "docs", label: "Docs" },
					]}
					value={tab}
					onValueChange={setTab}
				/>
			</div>

			{tab === "docs" ? (
				<div className="code-manage__list">
					{DOCS.map((doc) => (
						<div key={doc.id} className="code-manage__row">
							<FileText size={14} aria-hidden="true" />
							<span className="code-manage__name">{doc.name}</span>
							<span className="code-manage__meta">{doc.meta}</span>
							<button
								className="code-manage__remove"
								aria-label={`Remove ${doc.name}`}
							>
								<Trash2 size={14} aria-hidden="true" />
							</button>
						</div>
					))}
				</div>
			) : (
				<div className="code-manage__list">
					{(tab === "skills" ? SKILLS : TOOLS).map((item) => (
						<div key={item.id} className="code-manage__row">
							<div className="code-manage__row-main">
								<span className="code-manage__name code-manage__name--mono">
									{item.name}
								</span>
								<span className="code-manage__desc">{item.desc}</span>
							</div>
							<Switch
								defaultChecked={item.on}
								aria-label={`Enable ${item.name}`}
							/>
						</div>
					))}
				</div>
			)}
		</Dialog>
	);
}
