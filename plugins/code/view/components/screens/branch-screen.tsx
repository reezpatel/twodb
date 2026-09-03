import { Check, GitBranch, Search } from "lucide-react";
import { branchScreenStyles } from "./branch-screen.style";

interface Branch {
	id: string;
	name: string;
	ahead?: number;
	behind?: number;
	time: string;
	current?: boolean;
}

const CURRENT: Branch = {
	id: "main",
	name: "main",
	time: "12m",
	current: true,
};

const RECENT: Branch[] = [
	{ id: "drag", name: "feat/editor-drag-handle", ahead: 3, time: "2h" },
	{
		id: "migrations",
		name: "fix/migration-order",
		ahead: 1,
		behind: 2,
		time: "1d",
	},
	{ id: "tokens", name: "chore/token-audit", time: "3d" },
	{ id: "usage", name: "feat/usage-panel", ahead: 5, time: "4d" },
];

function BranchRow({ branch }: { branch: Branch }) {
	return (
		<button className="code-branch__row">
			<span className="code-branch__check">
				{branch.current ? <Check size={14} aria-hidden="true" /> : null}
			</span>
			<GitBranch size={14} aria-hidden="true" />
			<span className="code-branch__name">{branch.name}</span>
			<span className="code-branch__meta">
				{branch.ahead ? (
					<span className="code-branch__up">↑{branch.ahead}</span>
				) : null}
				{branch.behind ? (
					<span className="code-branch__down">↓{branch.behind}</span>
				) : null}
				{branch.time}
			</span>
		</button>
	);
}

export function BranchScreen() {
	return (
		<div className="code-branch">
			<style jsx>{branchScreenStyles}</style>
			<div className="code-branch__search">
				<Search size={14} aria-hidden="true" />
				<input
					className="code-branch__input"
					placeholder="Switch branch — type to filter…"
				/>
			</div>

			<div className="code-branch__list">
				<div className="code-branch__group">Current</div>
				<BranchRow branch={CURRENT} />
				<div className="code-branch__group">Recent</div>
				{RECENT.map((branch) => (
					<BranchRow key={branch.id} branch={branch} />
				))}
			</div>

			<div className="code-branch__footer">
				<span>
					<kbd>↵</kbd> checkout
				</span>
				<span>
					<kbd>⌘N</kbd> new branch
				</span>
			</div>
		</div>
	);
}
