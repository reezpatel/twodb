import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NodeStats, ThreadUsagePayload } from "@twodb/contracts";
import type { SessionDto, SessionMessageDto } from "../../shared/types";
import { codeApi } from "../lib/api";

export type StreamStatus = "connecting" | "open" | "closed";

export interface LiveToolCall {
	id: string;
	name: string;
	state: "running" | "done" | "error";
	partial: string;
	args?: Record<string, unknown>;
}

const OLDER_PAGE_SIZE = 50;
const RECONNECT_DELAY_MS = 1_500;

const wsUrl = (sessionId: string): string => {
	const base = window.location.origin.replace(/^http/i, "ws");
	const workspaceId = localStorage.getItem("activeWorkspaceId");
	const query = workspaceId ? `?workspace_id=${workspaceId}` : "";
	return `${base}/api/v1/io.twodb.code/sessions/${sessionId}/ws${query}`;
};

/** text of a persisted message's text blocks (assistant/user/toolResult). */
export function messageText(message: Record<string, unknown>): string {
	if (!message || typeof message !== "object") return "";
	const content = message.content;
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter(
				(block): block is { type: string; text: string } =>
					typeof block === "object" &&
					block !== null &&
					(block as { type?: unknown }).type === "text" &&
					typeof (block as { text?: unknown }).text === "string",
			)
			.map((block) => block.text)
			.join("\n");
	}
	if (content && typeof content === "object") {
		const text = (content as { text?: unknown }).text;
		if (typeof text === "string") return text;
		const error = (content as { error?: unknown }).error;
		if (typeof error === "string") return error;
		return JSON.stringify(content);
	}
	return "";
}

/** toolCall blocks inside an assistant message. */
export function messageToolCalls(
	message: Record<string, unknown>,
): { id: string; name: string }[] {
	const content = message.content;
	if (!Array.isArray(content)) return [];
	return content
		.filter(
			(block): block is { type: string; id: string; name: string } =>
				typeof block === "object" &&
				block !== null &&
				(block as { type?: unknown }).type === "toolCall" &&
				typeof (block as { id?: unknown }).id === "string" &&
				typeof (block as { name?: unknown }).name === "string",
		)
		.map((block) => ({ id: block.id, name: block.name }));
}

export function useSessionStream(sessionId: string) {
	const [status, setStatus] = useState<StreamStatus>("connecting");
	const [session, setSession] = useState<SessionDto | null>(null);
	const [messages, setMessages] = useState<SessionMessageDto[]>([]);
	const [hasOlder, setHasOlder] = useState(false);
	const [loadingOlder, setLoadingOlder] = useState(false);
	const [running, setRunning] = useState(false);
	const [usage, setUsage] = useState<ThreadUsagePayload | null>(null);
	const [stats, setStats] = useState<NodeStats | null>(null);
	const [liveAssistant, setLiveAssistant] = useState<string | null>(null);
	const [liveTools, setLiveTools] = useState<LiveToolCall[]>([]);
	const [error, setError] = useState<string | null>(null);

	const socketRef = useRef<WebSocket | null>(null);
	const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastSeqRef = useRef(-1);
	const oldestSeqRef = useRef<number | null>(null);

	const appendMessages = useCallback((incoming: SessionMessageDto[]) => {
		setMessages((previous) => {
			const seen = new Set(previous.map((message) => message.seq));
			const fresh = incoming.filter((message) => !seen.has(message.seq));
			if (fresh.length === 0) return previous;
			return [...previous, ...fresh].sort((a, b) => a.seq - b.seq);
		});
		for (const message of incoming) {
			if (message.seq > lastSeqRef.current) lastSeqRef.current = message.seq;
		}
	}, []);

	useEffect(() => {
		if (!sessionId) return undefined;
		let disposed = false;

		setStatus("connecting");
		setMessages([]);
		setHasOlder(false);
		setLiveAssistant(null);
		setLiveTools([]);
		setUsage(null);
		setStats(null);
		setError(null);
		lastSeqRef.current = -1;

		const connect = (afterSeq?: number) => {
			if (disposed) return;
			const socket = new WebSocket(wsUrl(sessionId));
			socketRef.current = socket;

			socket.onopen = () => {
				if (disposed) return;
				setStatus("open");
				socket.send(
					JSON.stringify(
						afterSeq !== undefined && afterSeq >= 0
							? { type: "sync", after_seq: afterSeq }
							: { type: "sync" },
					),
				);
			};

			socket.onmessage = (event) => {
				if (disposed) return;
				let frame: Record<string, unknown>;
				try {
					frame = JSON.parse(String(event.data)) as Record<string, unknown>;
				} catch {
					return;
				}
				handleFrame(frame);
			};

			socket.onclose = () => {
				if (disposed) return;
				setStatus("closed");
				socketRef.current = null;
				reconnectTimer.current = setTimeout(
					() => connect(lastSeqRef.current),
					RECONNECT_DELAY_MS,
				);
			};

			socket.onerror = () => {
				// onclose follows and handles the reconnect
			};
		};

		const handleFrame = (frame: Record<string, unknown>) => {
			switch (frame.type) {
				case "snapshot": {
					const page = (frame.messages as SessionMessageDto[]) ?? [];
					if (frame.incremental) {
						appendMessages(page);
					} else {
						setMessages(page);
						setHasOlder(page.length >= OLDER_PAGE_SIZE);
						lastSeqRef.current =
							page.length > 0 ? page[page.length - 1].seq : -1;
						oldestSeqRef.current = page.length > 0 ? page[0].seq : null;
					}
					setSession((frame.session as SessionDto) ?? null);
					setRunning(frame.running === true);
					if (frame.usage) setUsage(frame.usage as ThreadUsagePayload);
					break;
				}
				case "message-start":
					if ((frame.message as { role?: string })?.role === "assistant") {
						setLiveAssistant("");
					}
					break;
				case "message-update": {
					const delta = frame.delta as
						| { type?: string; delta?: unknown }
						| undefined;
					const chunk = typeof delta?.delta === "string" ? delta.delta : "";
					if (chunk && delta?.type === "text") {
						setLiveAssistant((previous) => (previous ?? "") + chunk);
					}
					break;
				}
				case "message-end": {
					const dto = (frame as { message?: SessionMessageDto }).message;
					if (dto) {
						appendMessages([dto]);
						if (dto.role === "assistant") setLiveAssistant(null);
						if (
							dto.role === "tool_result" ||
							dto.role === "toolResult" ||
							dto.role === "tool_use"
						) {
							const inner = dto.message as {
								tool_call_id?: unknown;
								toolCallId?: unknown;
							};
							const callId = inner.tool_call_id ?? inner.toolCallId;
							setLiveTools((previous) =>
								previous.filter((tool) => tool.id !== callId),
							);
						}
					}
					break;
				}
				case "tool-start":
					setLiveTools((previous) =>
						previous.some((tool) => tool.id === frame.tool_call_id)
							? previous.map((tool) =>
									tool.id === frame.tool_call_id
										? { ...tool, state: "running" as const }
										: tool,
								)
							: [
									...previous,
									{
										id: String(frame.tool_call_id),
										name: String(frame.tool_name ?? "tool"),
										state: "running" as const,
										partial: "",
									},
								],
					);
					break;
				case "tool-args":
					setLiveTools((previous) =>
						previous.map((tool) =>
							tool.id === frame.tool_call_id
								? {
										...tool,
										args: frame.args as Record<string, unknown> | undefined,
									}
								: tool,
						),
					);
					break;
				case "tool-update":
					setLiveTools((previous) =>
						previous.map((tool) =>
							tool.id === frame.tool_call_id
								? {
										...tool,
										partial:
											tool.partial + extractPartialText(frame.partial_result),
									}
								: tool,
						),
					);
					break;
				case "tool-end":
					setLiveTools((previous) =>
						previous.map((tool) =>
							tool.id === frame.tool_call_id
								? { ...tool, state: frame.is_error ? "error" : "done" }
								: tool,
						),
					);
					break;
				case "usage":
					setUsage(frame as unknown as ThreadUsagePayload);
					break;
				case "stats":
					setStats((frame as { stats?: NodeStats }).stats ?? null);
					break;
				case "run-state":
					setRunning(frame.running === true);
					if (frame.running !== true) {
						setLiveAssistant(null);
						setLiveTools([]);
					}
					if (typeof frame.error === "string") setError(frame.error);
					break;
				case "compacted":
					lastSeqRef.current = -1;
					setMessages([]);
					socketRef.current?.send(JSON.stringify({ type: "sync" }));
					break;
				case "error":
					setError(String(frame.error ?? "unknown error"));
					break;
			}
		};

		connect();

		return () => {
			disposed = true;
			if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
			socketRef.current?.close();
			socketRef.current = null;
		};
	}, [sessionId, appendMessages]);

	const send = useCallback((text: string) => {
		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			setError("not connected — reconnecting…");
			return false;
		}
		setError(null);
		socket.send(JSON.stringify({ type: "prompt", text }));
		return true;
	}, []);

	const stop = useCallback(() => {
		socketRef.current?.send(JSON.stringify({ type: "stop" }));
	}, []);

	/** Re-request a fresh snapshot (e.g. after the session's agent changed). */
	const sync = useCallback(() => {
		socketRef.current?.send(JSON.stringify({ type: "sync" }));
	}, []);

	const loadOlder = useCallback(async () => {
		if (!sessionId || loadingOlder) return;
		const cursor = oldestSeqRef.current;
		if (cursor === null) return;
		setLoadingOlder(true);
		try {
			const data = await codeApi.get<{ messages: SessionMessageDto[] }>(
				`/sessions/${sessionId}/messages?before=${cursor}&limit=${OLDER_PAGE_SIZE}`,
			);
			const page = data.messages;
			setHasOlder(page.length >= OLDER_PAGE_SIZE);
			if (page.length > 0) {
				oldestSeqRef.current = page[0].seq;
				setMessages((previous) => {
					const seen = new Set(previous.map((message) => message.seq));
					return [
						...page.filter((message) => !seen.has(message.seq)),
						...previous,
					];
				});
			}
		} finally {
			setLoadingOlder(false);
		}
	}, [sessionId, loadingOlder]);

	const fetchFullMessage = useCallback(
		async (messageId: string): Promise<SessionMessageDto | null> => {
			if (!sessionId) return null;
			const data = await codeApi.get<{ message: SessionMessageDto }>(
				`/sessions/${sessionId}/messages/${messageId}`,
			);
			return data.message;
		},
		[sessionId],
	);

	return useMemo(
		() => ({
			status,
			session,
			messages,
			hasOlder,
			loadingOlder,
			running,
			usage,
			stats,
			liveAssistant,
			liveTools,
			error,
			send,
			stop,
			sync,
			loadOlder,
			fetchFullMessage,
		}),
		[
			status,
			session,
			messages,
			hasOlder,
			loadingOlder,
			running,
			usage,
			stats,
			liveAssistant,
			liveTools,
			error,
			send,
			stop,
			sync,
			loadOlder,
			fetchFullMessage,
		],
	);
}

function extractPartialText(partial: unknown): string {
	if (typeof partial === "string") return partial;
	if (!partial || typeof partial !== "object") return "";
	const content = (partial as { content?: unknown }).content;
	if (!Array.isArray(content)) return "";
	return content
		.filter(
			(block): block is { type: string; text: string } =>
				typeof block === "object" &&
				block !== null &&
				(block as { type?: unknown }).type === "text" &&
				typeof (block as { text?: unknown }).text === "string",
		)
		.map((block) => block.text)
		.join("");
}
