import { useState } from "react";
import { Plus, X } from "lucide-react";
import { terminalScreenStyles } from "./terminal-screen.style";

type LineKind = "cmd" | "out" | "ok" | "err" | "dim";

interface TermLine {
	kind: LineKind;
	text: string;
}

const TERMINAL_TABS = [
	{ id: "zsh", label: "zsh" },
	{ id: "dev", label: "dev server" },
	{ id: "api", label: "api watch" },
];

const LINES: TermLine[] = [
	{ kind: "cmd", text: "pnpm dev" },
	{ kind: "dim", text: "" },
	{ kind: "out", text: "  VITE v6.3.5  ready in 412 ms" },
	{ kind: "out", text: "  ➜  Local:   http://localhost:5173/" },
	{ kind: "out", text: "  ➜  Network: use --host to expose" },
	{ kind: "dim", text: "" },
	{ kind: "cmd", text: "pnpm --filter @twodb/api exec tsc --noEmit" },
	{ kind: "ok", text: "✓ no type errors (8.2s)" },
	{ kind: "dim", text: "" },
	{ kind: "cmd", text: "git status --short" },
	{
		kind: "out",
		text: " M packages/ui/src/components/markdown-editor/block-drag-handle.tsx",
	},
	{
		kind: "out",
		text: " M packages/ui/src/components/markdown-editor/markdown-editor.tsx",
	},
	{
		kind: "err",
		text: "?? packages/ui/src/components/markdown-editor/.slash-menu.tsx.swp",
	},
];

export function TerminalScreen() {
	const [tab, setTab] = useState("dev");

	return (
		<div className="code-term">
			<style jsx>{terminalScreenStyles}</style>
			<div className="code-term__tabs">
				{TERMINAL_TABS.map((t) => (
					<button
						key={t.id}
						className={`code-term__tab${tab === t.id ? " is-active" : ""}`}
						onClick={() => setTab(t.id)}
					>
						{t.label}
						<span className="code-term__tab-close" aria-hidden="true">
							<X size={11} />
						</span>
					</button>
				))}
				<button className="code-term__tab-new" aria-label="New terminal">
					<Plus size={13} aria-hidden="true" />
				</button>
			</div>

			<div className="code-term__body">
				{LINES.map((line, i) =>
					line.kind === "cmd" ? (
						<div key={i} className="code-term__line">
							<span className="code-term__prompt">~/twodb ❯</span>
							<span className="code-term__cmd">{line.text}</span>
						</div>
					) : (
						<div
							key={i}
							className={`code-term__line code-term__line--${line.kind}`}
						>
							{line.text || " "}
						</div>
					),
				)}
				<div className="code-term__line">
					<span className="code-term__prompt">~/twodb ❯</span>
					<span className="code-term__cursor" />
				</div>
			</div>
		</div>
	);
}
