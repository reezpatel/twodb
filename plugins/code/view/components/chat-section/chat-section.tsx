import { IconButton } from "@twodb/ui";
import { useState } from "react";
import {
	ArrowUp,
	AtSign,
	Code2,
	FileCode2,
	GitBranch,
	GitCommitHorizontal,
	History,
	Paperclip,
	Terminal,
	Wrench,
} from "lucide-react";
import { BranchScreen } from "../screens/branch-screen";
import { ChangesScreen } from "../screens/changes-screen";
import { CheckpointsScreen } from "../screens/checkpoints-screen";
import { TerminalScreen } from "../screens/terminal-screen";
import { chatSectionStyles } from "./chat-section.style";

type ScreenId = "code" | "branch" | "terminal" | "checkpoints" | "changes";

const TOP_TOOLS: { id: ScreenId; label: string; icon: typeof Code2 }[] = [
	{ id: "code", label: "Code", icon: Code2 },
	{ id: "branch", label: "main", icon: GitBranch },
	{ id: "terminal", label: "Terminal", icon: Terminal },
	{ id: "checkpoints", label: "Checkpoints", icon: History },
	{ id: "changes", label: "Changes", icon: GitCommitHorizontal },
];

type Message =
	| { id: string; role: "user"; text: string }
	| { id: string; role: "agent"; text: string; streaming?: boolean }
	| { id: string; role: "tool"; text: string };

const MESSAGES: Message[] = [
	{
		id: "m1",
		role: "user",
		text: "Move the drag handle into @twodb/ui and make it work with the custom blocks.",
	},
	{
		id: "m2",
		role: "agent",
		text: "Done. The handle now lives in the design system and renders for every top-level block, including ::map custom blocks.",
	},
	{
		id: "m3",
		role: "tool",
		text: "edit packages/ui/src/components/markdown-editor/block-drag-handle.tsx",
	},
	{
		id: "m4",
		role: "tool",
		text: "bash pnpm --filter @twodb/ui exec tsc --noEmit  ·  exit 0",
	},
	{
		id: "m5",
		role: "agent",
		text: "Also fixed the drop surface — the editor now fills the pane, so drops below the text still land on a block. Typecheck is green.",
	},
	{
		id: "m6",
		role: "agent",
		text: "Wiring the slash menu into the custom block picker next",
		streaming: true,
	},
];

const INFO_STATS = [
	{ label: "file", value: "markdown-editor.tsx" },
	{ label: "tokens", value: "↑ 12.4k · ↓ 3.1k" },
	{ label: "ctx", value: "38% of 200k" },
	{ label: "speed", value: "42 tok/s" },
	{ label: "ram", value: "1.2 GB" },
	{ label: "cpu", value: "14%" },
	{ label: "cost", value: "$0.023" },
];

export const ChatSection = () => {
	const [screen, setScreen] = useState<ScreenId>("code");

	return (
		<main className="code-chat">
			<style jsx>{chatSectionStyles}</style>

			<div className="code-chat__tools">
				{TOP_TOOLS.map((tool) => (
					<button
						key={tool.id}
						className={`code-chat__tool${screen === tool.id ? " is-active" : ""}`}
						onClick={() => setScreen(tool.id)}
					>
						<tool.icon size={14} aria-hidden="true" />
						{tool.label}
					</button>
				))}
			</div>

			{screen === "terminal" ? <TerminalScreen /> : null}
			{screen === "branch" ? <BranchScreen /> : null}
			{screen === "changes" ? <ChangesScreen /> : null}
			{screen === "checkpoints" ? <CheckpointsScreen /> : null}

			{screen === "code" ? (
				<>
					<div className="code-chat__messages">
						{MESSAGES.map((message) =>
							message.role === "tool" ? (
								<div key={message.id} className="code-chat__tool-call">
									<Wrench size={12} aria-hidden="true" />
									<span className="code-chat__tool-call-text">
										{message.text}
									</span>
								</div>
							) : (
								<div
									key={message.id}
									className={`code-chat__message code-chat__message--${message.role}`}
								>
									<span className="code-chat__role">
										{message.role === "user" ? "You" : "Agent"}
									</span>
									<p className="code-chat__text">
										{message.text}
										{message.role === "agent" && message.streaming ? (
											<span className="code-chat__cursor" />
										) : null}
									</p>
								</div>
							),
						)}
					</div>

					<div className="code-chat__composer">
						<textarea
							className="code-chat__input"
							rows={2}
							placeholder="Ask the agent… (⌘⏎ to send)"
						/>
						<div className="code-chat__composer-bar">
							<IconButton label="Attach" icon={<Paperclip size={15} />} />
							<IconButton label="Mention" icon={<AtSign size={15} />} />
							<span className="code-chat__model">gpt-5-mini</span>
							<span className="code-chat__composer-spacer" />
							<IconButton
								label="Send"
								icon={<ArrowUp size={15} />}
								variant="secondary"
							/>
						</div>
					</div>

					<div className="code-chat__info">
						<span className="code-chat__info-item code-chat__info-item--file">
							<FileCode2 size={12} aria-hidden="true" />
							{INFO_STATS[0].value}
						</span>
						{INFO_STATS.slice(1).map((stat) => (
							<span key={stat.label} className="code-chat__info-item">
								<span className="code-chat__info-label">{stat.label}</span>
								{stat.value}
							</span>
						))}
					</div>
				</>
			) : null}
		</main>
	);
};
