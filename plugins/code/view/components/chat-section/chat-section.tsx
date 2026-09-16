import { Button, Dialog, IconButton, Select } from "@twodb/ui";
import { useEffect, useRef, useState } from "react";
import {
	ArrowUp,
	AtSign,
	Code2,
	FileCode2,
	GitBranch,
	GitCommitHorizontal,
	History,
	Loader2,
	Paperclip,
	Square,
	Terminal,
	Wrench,
} from "lucide-react";
import type { SessionMessageDto } from "../../../shared/types";
import {
	messageText,
	messageToolCalls,
	useSessionStream,
} from "../../hooks/use-session-stream.hook";
import { agentLabel, useSessionAgents } from "../../hooks/use-agents.hook";
import { useAgentModelDialog } from "../../hooks/use-agent-model-dialog.hook";
import { AgentModelDialog } from "./agent-model-dialog";
import { Markdown } from "../markdown/markdown";
import { ListDirOutput, asDirEntries } from "./tool-output-list-dir";
import { RunCommandOutput, asCommandResult } from "./tool-output-run-command";
import { useAgentSwitch } from "../../hooks/use-agent-switch.hook";
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

const formatTokens = (value: number): string =>
	value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);

const formatBytes = (bytes: number): string =>
	`${(bytes / 1024 ** 3).toFixed(1)} GB`;

type FetchFullMessage = (
	messageId: string,
) => Promise<SessionMessageDto | null>;

function FullOutputButton({
	messageId,
	fetchFullMessage,
	onLoaded,
}: {
	messageId: string;
	fetchFullMessage: FetchFullMessage;
	onLoaded: (text: string) => void;
}) {
	const [loading, setLoading] = useState(false);
	return (
		<button
			type="button"
			className="code-chat__tool-expand"
			disabled={loading}
			onClick={async () => {
				setLoading(true);
				try {
					const full = await fetchFullMessage(messageId);
					if (full) onLoaded(messageText(full.message));
				} finally {
					setLoading(false);
				}
			}}
		>
			{loading ? "loading…" : "view full output"}
		</button>
	);
}

function inputSummary(
	toolName: string,
	input: Record<string, unknown> | undefined,
): string {
	if (!input) return "";
	switch (toolName) {
		case "run_command": {
			const args = Array.isArray(input.args) ? input.args.join(" ") : "";
			return [input.command, args].filter(Boolean).join(" ");
		}
		case "read_file":
		case "write_file":
		case "edit_file":
			return typeof input.path === "string" ? input.path : "";
		case "list_dir":
			return typeof input.path === "string" ? input.path : ".";
		case "find_file":
			return typeof input.query === "string" ? input.query : "";
		case "apply_patch":
			return "unified diff";
		default:
			return "";
	}
}

function ToolResultMessage({
	message,
	fetchFullMessage,
}: {
	message: SessionMessageDto;
	fetchFullMessage: FetchFullMessage;
}) {
	const [full, setFull] = useState<string | null>(null);
	const [expanded, setExpanded] = useState(false);
	const inner = message.message as {
		tool_name?: unknown;
		toolName?: unknown;
		input?: unknown;
		result?: { content?: unknown; is_error?: boolean };
		content?: unknown;
		is_error?: unknown;
		isError?: unknown;
	};
	const toolName = String(inner.tool_name ?? inner.toolName ?? "tool");
	const resultContent = inner.result ? inner.result.content : inner.content;
	const isError =
		(inner.result?.is_error ?? inner.is_error ?? inner.isError) === true;
	const text = full ?? messageText({ content: resultContent });
	const input = inner.input as Record<string, unknown> | undefined;
	const dirEntries =
		toolName === "list_dir" ? asDirEntries(resultContent) : null;
	const commandResult =
		toolName === "run_command" ? asCommandResult(resultContent) : null;
	const preview =
		inputSummary(toolName, input) ||
		(dirEntries
			? `${dirEntries.length} ${dirEntries.length === 1 ? "entry" : "entries"}`
			: text.split("\n")[0]?.trim());
	return (
		<div className="code-chat__tool-group">
			<div className={`code-chat__tool-call${isError ? " is-error" : ""}`}>
				<Wrench size={12} aria-hidden="true" />
				<span className="code-chat__tool-call-text">
					{toolName}
					{preview ? ` · ${preview}` : ""}
				</span>
				{text ? (
					<button
						type="button"
						className="code-chat__tool-expand"
						onClick={() => setExpanded((value) => !value)}
					>
						{expanded ? "hide" : "output"}
					</button>
				) : null}
			</div>
			{expanded && text ? (
				<>
					{dirEntries ? (
						<ListDirOutput
							entries={dirEntries}
							cwd={typeof input?.path === "string" ? input.path : undefined}
						/>
					) : commandResult ? (
						<RunCommandOutput result={commandResult} />
					) : (
						<pre className="code-chat__tool-output">{text}</pre>
					)}
					{message.truncated && full === null ? (
						<FullOutputButton
							messageId={message.id}
							fetchFullMessage={fetchFullMessage}
							onLoaded={setFull}
						/>
					) : null}
				</>
			) : null}
		</div>
	);
}

function Message({
	message,
	fetchFullMessage,
}: {
	message: SessionMessageDto;
	fetchFullMessage: FetchFullMessage;
}) {
	const [full, setFull] = useState<string | null>(null);

	if (
		message.role === "toolResult" ||
		message.role === "tool_result" ||
		message.role === "tool_use"
	) {
		return (
			<ToolResultMessage
				message={message}
				fetchFullMessage={fetchFullMessage}
			/>
		);
	}

	const text = full ?? messageText(message.message);
	const calls = messageToolCalls(message.message);
	const isUser = message.role === "user";

	return (
		<div
			className={`code-chat__message code-chat__message--${isUser ? "user" : "agent"}`}
		>
			<span className="code-chat__role">{isUser ? "You" : "Agent"}</span>
			{text && isUser ? <p className="code-chat__text">{text}</p> : null}
			{text && !isUser ? <Markdown>{text}</Markdown> : null}
			{calls.map((call) => (
				<div key={call.id} className="code-chat__tool-call">
					<Wrench size={12} aria-hidden="true" />
					<span className="code-chat__tool-call-text">{call.name}</span>
				</div>
			))}
			{message.truncated && full === null ? (
				<FullOutputButton
					messageId={message.id}
					fetchFullMessage={fetchFullMessage}
					onLoaded={setFull}
				/>
			) : null}
		</div>
	);
}

export const ChatSection = ({ sessionId }: { sessionId: string }) => {
	const [screen, setScreen] = useState<ScreenId>("code");
	const [draft, setDraft] = useState("");
	const stream = useSessionStream(sessionId);
	const agentsQuery = useSessionAgents();
	const agentSwitch = useAgentSwitch(sessionId, stream.sync);
	const scrollRef = useRef<HTMLDivElement | null>(null);

	// autoscroll to bottom on new messages / deltas
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [stream.messages.length, stream.liveAssistant, stream.liveTools.length]);

	const sendDraft = () => {
		const text = draft.trim();
		if (!text) return;
		if (stream.send(text)) setDraft("");
	};

	const usage = stream.usage;
	const stats = stream.stats;
	const agents = (agentsQuery.data ?? []).filter((agent) => agent.enabled);
	const hasHistory =
		stream.session?.thread_id != null || stream.messages.length > 0;
	const agentModelDialog = useAgentModelDialog(
		stream.session,
		agentsQuery.data ?? [],
		agentSwitch,
		hasHistory,
	);
	const ramUsed =
		stats?.memoryTotal != null && stats?.memoryFree != null
			? stats.memoryTotal - stats.memoryFree
			: null;
	const cpuPercent =
		stats?.loadavg?.[0] != null && stats.cpus
			? Math.min(100, Math.round((stats.loadavg[0] / stats.cpus) * 100))
			: null;

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
				!sessionId ? (
					<div className="code-chat__messages">
						<p className="code-chat__empty">
							Select a session on the left, or start a new one with +.
						</p>
					</div>
				) : (
					<>
						<div
							className="code-chat__messages"
							ref={scrollRef}
							onScroll={(event) => {
								if (
									event.currentTarget.scrollTop === 0 &&
									stream.hasOlder &&
									!stream.loadingOlder
								) {
									void stream.loadOlder();
								}
							}}
						>
							{stream.hasOlder ? (
								<button
									type="button"
									className="code-chat__older"
									disabled={stream.loadingOlder}
									onClick={() => void stream.loadOlder()}
								>
									{stream.loadingOlder ? "Loading…" : "Load older messages"}
								</button>
							) : null}

							{stream.messages.map((message) => (
								<Message
									key={message.id}
									message={message}
									fetchFullMessage={stream.fetchFullMessage}
								/>
							))}

							{stream.liveTools.map((tool) => (
								<div
									key={tool.id}
									className={`code-chat__tool-call${tool.state === "error" ? " is-error" : ""}`}
								>
									{tool.state === "running" ? (
										<Loader2
											size={12}
											aria-hidden="true"
											className="code-chat__spin"
										/>
									) : (
										<Wrench size={12} aria-hidden="true" />
									)}
									<span className="code-chat__tool-call-text">
										{tool.name}
										{inputSummary(tool.name, tool.args)
											? ` · ${inputSummary(tool.name, tool.args)}`
											: ""}
										{tool.partial ? ` · ${tool.partial}` : ""}
									</span>
								</div>
							))}

							{stream.liveAssistant !== null ? (
								<div className="code-chat__message code-chat__message--agent">
									<span className="code-chat__role">Agent</span>
									<Markdown>{stream.liveAssistant}</Markdown>
									<span className="code-chat__cursor" />
								</div>
							) : null}

							{stream.messages.length === 0 &&
							stream.liveAssistant === null &&
							stream.status === "open" ? (
								<p className="code-chat__empty">
									No messages yet — say something to kick the agent off.
								</p>
							) : null}
						</div>

						{stream.error ? (
							<p className="code-chat__error">{stream.error}</p>
						) : null}

						<div className="code-chat__composer">
							<textarea
								className="code-chat__input"
								rows={2}
								placeholder="Ask the agent… (⌘⏎ to send)"
								value={draft}
								onChange={(event) => setDraft(event.target.value)}
								onKeyDown={(event) => {
									if (
										(event.metaKey || event.ctrlKey) &&
										event.key === "Enter"
									) {
										event.preventDefault();
										sendDraft();
									}
								}}
							/>
							<div className="code-chat__composer-bar">
								<IconButton label="Attach" icon={<Paperclip size={15} />} />
								<IconButton label="Mention" icon={<AtSign size={15} />} />
								{agents.length > 0 ? (
									<Select
										aria-label="Agent"
										placeholder="agent"
										options={agents.map((agent) => ({
											value: agent.id,
											label: agentLabel(agent),
										}))}
										value={stream.session?.agent_id ?? ""}
										onValueChange={(value) =>
											agentSwitch.requestSwitch(value, hasHistory)
										}
										disabled={agentSwitch.switching}
									/>
								) : null}
								<span className="code-chat__composer-spacer" />
								{stream.running ? (
									<IconButton
										label="Stop"
										icon={<Square size={15} />}
										variant="secondary"
										onClick={stream.stop}
									/>
								) : (
									<IconButton
										label="Send"
										icon={<ArrowUp size={15} />}
										variant="secondary"
										onClick={sendDraft}
									/>
								)}
							</div>
						</div>

						<div className="code-chat__info">
							{agentModelDialog.current ? (
								<button
									type="button"
									className="code-chat__info-item code-chat__info-item--button"
									onClick={agentModelDialog.openDialog}
								>
									{agentModelDialog.currentInfo?.label ??
										agentModelDialog.current.provider}
									{" • "}
									{agentModelDialog.current.model ?? "no model"}
								</button>
							) : null}
							{stream.session ? (
								<span className="code-chat__info-item code-chat__info-item--file">
									<FileCode2 size={12} aria-hidden="true" />
									{stream.session.cwd}
								</span>
							) : null}
							<span className="code-chat__info-item">
								<span className="code-chat__info-label">tokens</span>
								{usage
									? `↑ ${formatTokens(usage.input_tokens)} · ↓ ${formatTokens(usage.output_tokens)}`
									: "—"}
							</span>
							<span className="code-chat__info-item">
								<span className="code-chat__info-label">ctx</span>
								{usage ? formatTokens(usage.context_tokens) : "—"}
							</span>
							<span className="code-chat__info-item">
								<span className="code-chat__info-label">speed</span>
								{usage?.tokens_per_second != null
									? `${usage.tokens_per_second} tok/s`
									: "—"}
							</span>
							<span className="code-chat__info-item">
								<span className="code-chat__info-label">ram</span>
								{ramUsed != null ? formatBytes(ramUsed) : "—"}
							</span>
							<span className="code-chat__info-item">
								<span className="code-chat__info-label">cpu</span>
								{cpuPercent != null ? `${cpuPercent}%` : "—"}
							</span>
						</div>
					</>
				)
			) : null}

			<AgentModelDialog dialog={agentModelDialog} />

			<Dialog
				open={agentSwitch.pendingAgentId !== null}
				onClose={agentSwitch.cancel}
				title="Switch connection"
				footer={
					<Button size="sm" variant="ghost" onClick={agentSwitch.cancel}>
						Cancel
					</Button>
				}
			>
				<p className="code-chat__switch-note">
					This session already has history. Choose how to carry it over:
				</p>
				<div className="code-chat__switch-options">
					{(
						[
							{
								mode: "continue",
								label: "Keep history",
								hint: "Switch now; the full conversation carries over",
							},
							{
								mode: "direct",
								label: "Switch directly",
								hint: "Start a fresh thread; this history stays untouched",
							},
							{
								mode: "compact",
								label: "Compact & switch",
								hint: "Summarize the conversation and carry the summary",
							},
							{
								mode: "clear",
								label: "Clear & switch",
								hint: "Wipe this thread's messages, then switch",
								danger: true,
							},
						] as const
					).map((option) => (
						<button
							key={option.mode}
							type="button"
							className={`code-chat__switch-option${
								"danger" in option ? " code-chat__switch-option--danger" : ""
							}`}
							disabled={agentSwitch.switching}
							onClick={() => agentSwitch.confirm(option.mode)}
						>
							<span className="code-chat__switch-option-label">
								{agentSwitch.switching ? "Switching…" : option.label}
							</span>
							<span className="code-chat__switch-option-hint">
								{option.hint}
							</span>
						</button>
					))}
				</div>
				{agentSwitch.switchError ? (
					<p className="code-chat__error">{agentSwitch.switchError}</p>
				) : null}
			</Dialog>
		</main>
	);
};
