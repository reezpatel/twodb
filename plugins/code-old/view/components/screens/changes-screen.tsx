import { useState } from "react";
import { changesScreenStyles } from "./changes-screen.style";

type FileStatus = "M" | "A" | "D";

interface ChangedFile {
	name: string;
	path: string;
	status: FileStatus;
	additions: number;
	deletions: number;
}

const STAGED: ChangedFile[] = [
	{
		name: "package.json",
		path: "packages/ui",
		status: "M",
		additions: 2,
		deletions: 0,
	},
];

const UNSTAGED: ChangedFile[] = [
	{
		name: "block-drag-handle.tsx",
		path: "packages/ui/src/components/markdown-editor",
		status: "M",
		additions: 48,
		deletions: 12,
	},
	{
		name: "markdown-editor.tsx",
		path: "packages/ui/src/components/markdown-editor",
		status: "M",
		additions: 22,
		deletions: 8,
	},
	{
		name: "usage-stats.tsx",
		path: "plugins/code/view/components/sidebar",
		status: "A",
		additions: 96,
		deletions: 0,
	},
];

const DIFF: { kind: "ctx" | "add" | "del" | "hunk"; text: string }[] = [
	{ kind: "hunk", text: "@@ -98,6 +98,14 @@ export function MarkdownEditor(" },
	{ kind: "ctx", text: "  const handle = useMemo(() => {" },
	{ kind: "del", text: "    return createHandle({ nested: false });" },
	{ kind: "add", text: "    return createHandle({" },
	{ kind: "add", text: "      nested: false," },
	{
		kind: "add",
		text: "      onNodeChange: ({ editor }) => editor.chain().focus(),",
	},
	{ kind: "add", text: "    });" },
	{ kind: "ctx", text: "  }, []);" },
];

function FileRow({ file }: { file: ChangedFile }) {
	return (
		<button className="code-changes__row">
			<span
				className={`code-changes__badge code-changes__badge--${file.status.toLowerCase()}`}
			>
				{file.status}
			</span>
			<span className="code-changes__name">{file.name}</span>
			<span className="code-changes__path">{file.path}</span>
			<span className="code-changes__stats">
				<span className="code-changes__add">+{file.additions}</span>
				<span className="code-changes__del">−{file.deletions}</span>
			</span>
		</button>
	);
}

export function ChangesScreen() {
	const [showDiff, setShowDiff] = useState(true);
	const total = STAGED.length + UNSTAGED.length;

	return (
		<div className="code-changes">
			<style jsx>{changesScreenStyles}</style>

			<div className="code-changes__list">
				<div className="code-changes__group">
					Unstaged
					<span className="code-changes__count">{UNSTAGED.length}</span>
				</div>
				{UNSTAGED.map((file) => (
					<FileRow key={file.name} file={file} />
				))}
				<div className="code-changes__group">
					Staged
					<span className="code-changes__count">{STAGED.length}</span>
				</div>
				{STAGED.map((file) => (
					<FileRow key={file.name} file={file} />
				))}
			</div>

			<div className="code-changes__diff-head">
				<span className="code-changes__diff-title">block-drag-handle.tsx</span>
				<button
					className="code-changes__diff-toggle"
					onClick={() => setShowDiff((v) => !v)}
				>
					{showDiff ? "Hide diff" : "Show diff"}
				</button>
			</div>
			{showDiff ? (
				<div className="code-changes__diff">
					{DIFF.map((line, i) => (
						<div
							key={i}
							className={`code-changes__diff-line code-changes__diff-line--${line.kind}`}
						>
							{line.text}
						</div>
					))}
				</div>
			) : null}

			<div className="code-changes__footer">
				{total} changed files · +168 −20
			</div>
		</div>
	);
}
