import { File, Folder, Link2 } from "lucide-react";

export type DirEntry = {
	name: string;
	path: string;
	isDirectory: boolean;
	isFile: boolean;
	isSymbolicLink: boolean;
};

export function asDirEntries(content: unknown): DirEntry[] | null {
	if (!content || typeof content !== "object") return null;
	const entries = (content as { entries?: unknown }).entries;
	if (!Array.isArray(entries)) return null;
	return entries as DirEntry[];
}

export function ListDirOutput({
	entries,
	cwd,
}: {
	entries: DirEntry[];
	cwd?: string;
}) {
	const sorted = [...entries].sort(
		(a, b) =>
			Number(b.isDirectory) - Number(a.isDirectory) ||
			a.name.localeCompare(b.name),
	);
	return (
		<div className="code-chat__dir-list">
			{cwd ? <div className="code-chat__dir-cwd">{cwd}</div> : null}
			{sorted.map((entry) => (
				<div key={entry.path} className="code-chat__dir-entry">
					{entry.isDirectory ? (
						<Folder size={12} aria-hidden="true" />
					) : entry.isSymbolicLink ? (
						<Link2 size={12} aria-hidden="true" />
					) : (
						<File size={12} aria-hidden="true" />
					)}
					<span className="code-chat__dir-name">
						{entry.name}
						{entry.isDirectory ? "/" : ""}
					</span>
				</div>
			))}
		</div>
	);
}
