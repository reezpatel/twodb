import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CodeMessage, CodeSession } from "../sidenav/use-session-list";
import type { GitStatus } from "../directories/use-git-status";
import type { ComposerCommand } from "@/components/composer/composer-commands";
import type { AskUserAnswer, AskUserQuestion } from "./ask-user-wizard";
import { api } from "@/lib/api";

interface DbSkill {
  id: string;
  name: string;
  description: string;
  content: string;
}

interface RepoSkill {
  name: string;
  description: string;
  source: string;
}

export interface PendingAsset {
  uri: string;
  filename: string;
  contentType: string;
  size: number;
  previewUrl?: string;
  /** Client-side object URL for image thumbnails before sending. */
  localPreview?: string;
}

export type SessionDetail = CodeSession & {
  messages: CodeMessage[];
  /** Tail-window metadata — older pages arrive via /messages backfill. */
  messageWindow: { total: number; hasMore: boolean };
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number; contextTokens: number };
};

export interface SessionStats {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  contextTokens: number;
  tokPerSec: number | null;
}

/** The slim slice of git status the chat footer renders. */
export interface GitLine {
  branch: string | null;
  dirtyFiles: number;
  ahead: number | null;
  behind: number | null;
}

interface StreamFrame {
  type: string;
  active?: boolean;
  round?: number;
  text?: string;
  message?: string;
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
  stream?: "stdout" | "stderr";
  data?: string;
  output?: string;
  tools?: ToolEvent[];
  status?: string | null;
  thinking?: string;
  thinkingOpen?: boolean;
  stopped?: boolean;
  durationMs?: number;
  usage?: { inputTokens: number; outputTokens: number; cachedTokens: number };
  contextTokens?: number;
  git?: boolean;
  branch?: string | null;
  dirtyFiles?: number;
  ahead?: number | null;
  behind?: number | null;
  exitCode?: number;
  questions?: AskUserQuestion[];
  askUser?: { id: string; questions: AskUserQuestion[] } | null;
  /** /btw frames — status while summarizing, ok when the side thread closed. */
  sendToMain?: boolean | null;
}

export interface ToolEvent {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  output: string;
  done: boolean;
  startedAt?: number;
  completedAt?: number;
  status?: string;
}

export interface BtwState {
  /** The btw (side-thread) session id — dialog stays open across refreshes. */
  sessionId: string;
  /** First question to seed the btw composer with. */
  seed?: string;
}

export type WsStatus = "connecting" | "open" | "closed";

const COMPACT_ERRORS: Record<string, string> = {
  nothing_to_compact: "Nothing to compact — the context fits in the recent window kept verbatim.",
  session_busy: "Wait for the current run to finish before compacting.",
};

function wsUrl(sessionId: string) {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/api/code/sessions/${sessionId}/ws`;
}

/** Big photos/PNGs blow past provider image caps — shrink to a model-friendly
 * size in the browser before upload (long edge 1568, JPEG 0.9; keeps the
 * original when the re-encode isn't smaller). GIFs/SVGs pass through. */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const longEdge = Math.max(bitmap.width, bitmap.height);
    if (file.size <= 1_500_000 && longEdge <= 1568) {
      bitmap.close?.();
      return file;
    }
    const scale = Math.min(1, 1568 / longEdge);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export function useChatPanel(sessionId: string | null) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [liveTools, setLiveTools] = useState<ToolEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>("closed");
  const [statusText, setStatusText] = useState<string | null>(null);
  const [round, setRound] = useState<number | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [thinkingLive, setThinkingLive] = useState(false);
  const [thinkingStartedAt, setThinkingStartedAt] = useState<number | null>(null);
  const [thinkingDurationMs, setThinkingDurationMs] = useState<number | null>(null);
  const thinkingStartRef = useRef(0);
  const [optimistic, setOptimistic] = useState<CodeMessage | null>(null);
  const [compacting, setCompacting] = useState(false);
  const [askUser, setAskUser] = useState<{ id: string; questions: AskUserQuestion[] } | null>(null);
  const [pendingAssets, setPendingAssets] = useState<PendingAsset[]>([]);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitLine | null>(null);
  const [stats, setStats] = useState<SessionStats>({
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    contextTokens: 0,
    tokPerSec: null,
  });
  const liveDeltaRef = useRef({ count: 0, startedAt: 0 });
  const lastSentRef = useRef("");
  const lastConnectionRef = useRef<string | undefined>(undefined);
  const lastModelRef = useRef<string | undefined>(undefined);
  const lastThinkingRef = useRef<string | undefined>(undefined);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptRef = useRef(0);

  // ----- steering queue -----------------------------------------------------
  // Messages typed while a round is running are queued (steering), not sent.
  // When the run finishes they dispatch together as one user turn. The user
  // can also fire them immediately ("send now") — the run is stopped first.
  const [steering, setSteering] = useState<{ id: string; content: string; assets: PendingAsset[] }[]>([]);
  const steeringRef = useRef(steering);
  steeringRef.current = steering;
  const drainRef = useRef(false);

  // ----- /btw side thread ----------------------------------------------------
  const [btw, setBtw] = useState<BtwState | null>(null);
  const btwRef = useRef(btw);
  btwRef.current = btw;

  const session = useQuery({
    queryKey: ["code", "session", sessionId],
    queryFn: () => api<SessionDetail>(`/api/code/sessions/${sessionId}`),
    enabled: !!sessionId,
  });

  // ----- message pagination -------------------------------------------------
  // The session query ships only the newest window; older pages backfill on
  // scroll. History is append-only and rows are never evicted from this map,
  // so the accumulated set stays contiguous — a sliding tail window can only
  // expose rows the client already holds, never a gap.
  const [messagesById, setMessagesById] = useState<Map<string, CodeMessage>>(new Map());
  const [loadingOlder, setLoadingOlder] = useState(false);
  /** Set once a backfill page returns hasMore=false — window-level hasMore stays true forever. */
  const olderExhaustedRef = useRef(false);

  const mergeMessages = (rows: CodeMessage[]) =>
    setMessagesById((prev) => {
      let next = prev;
      for (const row of rows) {
        if (next === prev) next = new Map(prev);
        next.set(row.id, row);
      }
      return next;
    });

  const messages = useMemo(() => {
    const rows = [...messagesById.values()];
    rows.sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1));
    return rows;
  }, [messagesById]);

  // Reset accumulated history when switching sessions.
  useEffect(() => {
    setMessagesById(new Map());
    olderExhaustedRef.current = false;
    setSteering([]);
  }, [sessionId]);

  const tail = session.data?.messages ?? [];
  const windowHasMore = session.data?.messageWindow?.hasMore ?? false;
  useEffect(() => {
    if (tail.length === 0) return;
    mergeMessages(tail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tail, sessionId]);

  const hasOlder = windowHasMore && !olderExhaustedRef.current;

  const loadOlder = () => {
    if (loadingOlder || !hasOlder || messages.length === 0 || !sessionId) return;
    const oldest = messages[0];
    const before = `${new Date(oldest.createdAt).toISOString()}~${oldest.id}`;
    setLoadingOlder(true);
    void api<{ messages: CodeMessage[]; hasMore: boolean }>(`/api/code/sessions/${sessionId}/messages?before=${encodeURIComponent(before)}&limit=50`)
      .then((r) => {
        mergeMessages(r.messages);
        if (!r.hasMore) olderExhaustedRef.current = true;
      })
      .catch((e) => {
        setError((e as Error).message || "failed to load earlier messages");
      })
      .finally(() => setLoadingOlder(false));
  };

  const directoryId = session.data?.codeDirectoryId ?? null;
  const dbSkills = useQuery({
    queryKey: ["workspace", "skills", directoryId],
    queryFn: () => api<DbSkill[]>(`/api/skills${directoryId ? `?codeDirectoryId=${directoryId}` : ""}`),
    enabled: !!sessionId,
  });
  const repoSkills = useQuery({
    queryKey: ["code", "repo-skills", directoryId],
    queryFn: () => api<{ skills: RepoSkill[] }>(`/api/code/directories/${directoryId}/repo-skills`),
    enabled: !!directoryId,
  });

  // Live slash palette for skills: stored skills plus repo skills (titles only,
  // content streams in from the runner when expanded).
  const skillCommands = useMemo<ComposerCommand[]>(
    () => [
      ...(dbSkills.data ?? []).map((s) => ({ id: `skill:${s.id}`, label: s.name, description: s.description || "stored skill", group: "Skills" as const })),
      ...(repoSkills.data?.skills ?? []).map((s) => ({
        id: `repo-skill:${s.name}`,
        label: s.name,
        description: `${s.description} (runner)`,
        group: "Skills" as const,
      })),
    ],
    [dbSkills.data, repoSkills.data],
  );

  const invalidateAfterRun = () => {
    void queryClient.invalidateQueries({ queryKey: ["code", "session", sessionId] });
    void queryClient.invalidateQueries({ queryKey: ["code", "sessions"] });
    void queryClient.invalidateQueries({ queryKey: ["llm"] });
  };

  useEffect(() => {
    const u = session.data?.usage;
    if (u) {
      setStats({
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        cachedTokens: u.cachedTokens,
        contextTokens: u.contextTokens,
        tokPerSec: null,
      });
    }
  }, [session.data?.usage]);

  const applyFrame = (frame: StreamFrame) => {
    if (frame.type === "delta") {
      setStreaming((prev) => (prev ?? "") + (frame.text ?? ""));
      const live = liveDeltaRef.current;
      if (live.count === 0) live.startedAt = Date.now();
      live.count += 1;
      const elapsed = Date.now() - live.startedAt;
      if (elapsed > 400) {
        const tokPerSec = Math.round((live.count / elapsed) * 1000 * 10) / 10;
        setStats((prev) => ({ ...prev, tokPerSec }));
      }
    } else if (frame.type === "thinking_start") {
      setThinking("");
      setThinkingLive(true);
      thinkingStartRef.current = Date.now();
      setThinkingStartedAt(Date.now());
      setThinkingDurationMs(null);
    } else if (frame.type === "thinking_delta") {
      setThinking((prev) => (prev ?? "") + (frame.text ?? ""));
    } else if (frame.type === "thinking_end") {
      setThinkingLive(false);
      setThinkingDurationMs(Date.now() - thinkingStartRef.current);
    } else if (frame.type === "round_start") {
      liveDeltaRef.current = { count: 0, startedAt: 0 };
      thinkingStartRef.current = 0;
      setThinkingStartedAt(null);
      setThinkingDurationMs(null);
      // Round boundary: everything up to the previous round (incl. tool
      // results) is committed — refetch it and keep only the new round's
      // transient state.
      setRound(frame.round ?? null);
      setStreaming("");
      setLiveTools([]);
      setThinking(null);
      setThinkingLive(false);
      void queryClient.invalidateQueries({ queryKey: ["code", "session", sessionId] });
    } else if (frame.type === "round_done" && frame.usage && frame.durationMs) {
      const tokPerSec = frame.usage.outputTokens > 0 ? Math.round((frame.usage.outputTokens / frame.durationMs) * 1000 * 10) / 10 : null;
      setStats((prev) => ({
        inputTokens: prev.inputTokens + frame.usage!.inputTokens,
        outputTokens: prev.outputTokens + frame.usage!.outputTokens,
        cachedTokens: prev.cachedTokens + frame.usage!.cachedTokens,
        contextTokens: frame.usage!.inputTokens + frame.usage!.outputTokens,
        tokPerSec,
      }));
    } else if (frame.type === "tool_start") {
      setLiveTools((prev) => [...prev, { id: frame.id ?? "", name: frame.name ?? "tool", args: frame.args, output: "", done: false, startedAt: Date.now() }]);
    } else if (frame.type === "tool_output") {
      setLiveTools((prev) => prev.map((t) => (t.id === frame.id ? { ...t, output: t.output + (frame.data ?? "") } : t)));
    } else if (frame.type === "tool_result") {
      setLiveTools((prev) =>
        prev.map((t) =>
          t.id === frame.id ? { ...t, output: frame.output ?? t.output, done: true, completedAt: Date.now(), status: frame.status ?? undefined } : t,
        ),
      );
    } else if (frame.type === "run_state") {
      if (frame.active === false) {
        // No run in flight — drop stale transient state (the run finished while we were disconnected).
        setStreaming(null);
        setLiveTools([]);
        setStatusText(null);
        setRound(null);
        setAskUser(null);
      } else {
        // Resumed a run that was already in progress (reconnect or second viewer).
        setRound(frame.round ?? null);
        setStreaming(frame.text ?? "");
        setLiveTools(frame.tools ?? []);
        setStatusText(frame.status ?? null);
        setThinking(frame.thinking || null);
        setThinkingLive(Boolean(frame.thinkingOpen));
        setAskUser(frame.askUser ?? null);
      }
    } else if (frame.type === "ask_user") {
      // The agent is waiting on answers — the wizard replaces the composer.
      setAskUser({ id: frame.id ?? "", questions: frame.questions ?? [] });
    } else if (frame.type === "btw_status") {
      setStatusText(frame.text ?? null);
    } else if (frame.type === "btw_done_ok") {
      setStatusText(null);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["code", "session", sessionId] });
      void queryClient.invalidateQueries({ queryKey: ["code", "btw-session", sessionId] });
    } else if (frame.type === "busy") {
      // Server rejected the send — a run is already live on this session.
      setOptimistic(null);
      setDraft(lastSentRef.current);
      setError("The agent is already working on this session — your message wasn't sent.");
    } else if (frame.type === "error") {
      setError(frame.message ?? "stream error");
      setOptimistic(null);
      setStatusText(null);
      invalidateAfterRun();
    } else if (frame.type === "status") {
      setStatusText(frame.text ?? null);
    } else if (frame.type === "session_updated") {
      void queryClient.invalidateQueries({ queryKey: ["code", "sessions"] });
    } else if (frame.type === "compaction_done") {
      // Another viewer (or this one) just compacted — refetch so the block renders.
      void queryClient.invalidateQueries({ queryKey: ["code", "session", sessionId] });
    } else if (frame.type === "clear_done") {
      // Context cutoff landed — refetch for the divider + reset counters.
      void queryClient.invalidateQueries({ queryKey: ["code", "session", sessionId] });
    } else if (frame.type === "canvas") {
      // update_canvas landed — refresh the canvas tab.
      void queryClient.invalidateQueries({ queryKey: ["code", "artifacts", sessionId] });
    } else if (frame.type === "gitStatus") {
      // Pushed by the server when a run finishes — files likely changed.
      setGitStatus(
        frame.git === false
          ? null
          : { branch: frame.branch ?? null, dirtyFiles: frame.dirtyFiles ?? 0, ahead: frame.ahead ?? null, behind: frame.behind ?? null },
      );
      void queryClient.invalidateQueries({ queryKey: ["code", "directories"] });
    } else if (frame.type === "done") {
      setStreaming(null);
      setLiveTools([]);
      setOptimistic(null);
      setStatusText(null);
      setRound(null);
      setThinking(null);
      setThinkingLive(false);
      setAskUser(null);
      if (frame.usage) {
        setStats((prev) => ({
          ...prev,
          inputTokens: prev.inputTokens,
          contextTokens: frame.contextTokens ?? prev.contextTokens,
        }));
      }
      invalidateAfterRun();
    }
  };

  // Drop the optimistic user message once the committed history contains it.
  useEffect(() => {
    if (!optimistic) return;
    const committed = messages;
    if (committed.some((m) => m.role === "user" && m.content === optimistic.content)) setOptimistic(null);
  }, [messages, optimistic]);

  // Restore an unanswered ask_user from the transcript when no live run state
  // provides it — refreshes, reconnects, even a server restart keep the wizard.
  useEffect(() => {
    if (askUser || streaming !== null) return;
    const committed = messages;
    const answered = new Set<string>();
    for (const m of committed) {
      if (m.role === "tool") {
        const meta = m.meta as { toolCallId?: string } | null;
        if (meta?.toolCallId) answered.add(meta.toolCallId);
      }
    }
    for (let i = committed.length - 1; i >= 0; i--) {
      if (committed[i].role !== "ask_user") continue;
      const meta = committed[i].meta as { toolCallId?: string; questions?: AskUserQuestion[] } | null;
      if (meta?.toolCallId && meta.questions?.length && !answered.has(meta.toolCallId)) {
        setAskUser({ id: meta.toolCallId, questions: meta.questions });
      }
      break;
    }
  }, [messages, askUser, streaming]);

  // Restore an open /btw side thread after refresh — the main session's
  // runtimeState carries the btw session id until it's done (locked).
  useEffect(() => {
    const state = (session.data as unknown as { runtimeState?: Record<string, unknown> | null } | undefined)?.runtimeState;
    if (!state || btwRef.current) return;
    const btwId = state.btwCodeSessionId;
    if (typeof btwId === "string" && btwId) setBtw({ sessionId: btwId });
  }, [session.data]);

  /** Closes the dialog — the btw session stays in runtimeState if not done. */
  const closeBtw = () => setBtw(null);

  /** Re-opens an existing side thread (clicking its block in the transcript). */
  const openBtwSession = (sessionId2: string) => setBtw({ sessionId: sessionId2 });

  /** Creates the /btw side session bound to an agent, registers it in the
   * main session's runtimeState, and opens the dialog. */
  const startBtw = async (agentId: string, question: string, codeDirectoryId: string | null) => {
    const mainId = sessionId;
    if (!mainId) return;
    setError(null);
    try {
      const created = await api<CodeSession>("/api/code/sessions", {
        method: "POST",
        body: JSON.stringify({
          type: "sub_agent",
          parentSessionId: mainId,
          agentId,
          codeDirectoryId,
          interactive: true,
          title: question ? `/btw — ${question.slice(0, 40)}` : "/btw",
        }),
      });
      // Persist so a refresh re-opens the dialog (until it's done/locked).
      const current = (session.data as unknown as { runtimeState?: Record<string, unknown> | null })?.runtimeState ?? {};
      await api(`/api/code/sessions/${mainId}`, {
        method: "PATCH",
        body: JSON.stringify({ runtimeState: { ...current, btwCodeSessionId: created.id } }),
      });
      setBtw({ sessionId: created.id, seed: question || undefined });
    } catch (e) {
      setError((e as Error).message || "failed to start /btw");
    }
  };
  useEffect(() => {
    const dirId = session.data?.codeDirectoryId;
    if (!dirId) {
      setGitStatus(null);
      return;
    }
    api<GitStatus>(`/api/code/directories/${dirId}/git-status`)
      .then((s) => setGitStatus(s.git ? { branch: s.branch, dirtyFiles: s.dirtyFiles, ahead: s.ahead, behind: s.behind } : null))
      .catch(() => {});
  }, [session.data?.codeDirectoryId]);

  useEffect(() => {
    if (!sessionId) {
      setWsStatus("closed");
      return;
    }

    let disposed = false;
    const connect = () => {
      if (disposed) return;
      setWsStatus("connecting");
      const ws = new WebSocket(wsUrl(sessionId));
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
        // A reconnect may have missed a `done` frame — refresh persisted state.
        if (attemptRef.current > 0) invalidateAfterRun();
        attemptRef.current = 0;
        setWsStatus("open");
        setError(null);
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, 30_000);
      };

      ws.onmessage = (evt) => {
        try {
          applyFrame(JSON.parse(evt.data as string) as StreamFrame);
        } catch {
          // skip malformed frame
        }
      };

      ws.onclose = () => {
        if (pingRef.current) clearInterval(pingRef.current);
        if (disposed) return;
        setWsStatus("closed");
        attemptRef.current += 1;
        const delay = Math.min(1000 * 2 ** (attemptRef.current - 1), 15_000);
        retryRef.current = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
      setStreaming(null);
      setLiveTools([]);
      setRound(null);
      setThinking(null);
      setThinkingLive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  /** POSTs /compact — the server summarizes older history into a compaction row. */
  const compact = async (connectionId: string, model: string, instructions?: string) => {
    setCompacting(true);
    setError(null);
    setStatusText("compacting…");
    try {
      await api<CodeMessage>(`/api/code/sessions/${sessionId}/compact`, {
        method: "POST",
        body: JSON.stringify({ connectionId, model, instructions: instructions || undefined }),
      });
    } catch (e) {
      setError(COMPACT_ERRORS[(e as Error).message] ?? "compaction failed");
    } finally {
      setCompacting(false);
      setStatusText(null);
      invalidateAfterRun();
    }
  };

  /** POSTs /clear — instant context cutoff, no LLM call, nothing replayed. */
  const clearContext = async () => {
    setError(null);
    try {
      await api<CodeMessage>(`/api/code/sessions/${sessionId}/clear`, { method: "POST" });
    } catch (e) {
      setError((e as Error).message === "session_busy" ? "Wait for the current run to finish before clearing." : (e as Error).message || "clear failed");
    } finally {
      invalidateAfterRun();
    }
  };

  /** Sends an already-resolved message over the WS — everything the intercepts hand off to. */
  /** Uploads files to the agent_assets destination — any file, any model; the link notation works everywhere. */
  const uploadAssets = async (files: FileList | File[]) => {
    if (!sessionId) return;
    setUploadingAssets(true);
    setError(null);
    try {
      const uploaded: PendingAsset[] = [];
      for (const raw of Array.from(files)) {
        const file = await shrinkImage(raw);
        const localPreview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
        // Raw fetch — multipart boundaries must come from the browser, and the
        // api() helper forces a JSON content-type.
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/code/sessions/${sessionId}/assets`, { method: "POST", credentials: "include", body: form });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `upload failed (${res.status})`);
        }
        uploaded.push({ ...(await res.json()), localPreview });
      }
      setPendingAssets((prev) => [...prev, ...uploaded]);
    } catch (e) {
      const code = (e as Error).message;
      setError(
        code === "agent_assets_not_configured"
          ? "No Agents Assets destination configured — set one in Settings → Storage first."
          : code === "file_too_large"
            ? "Files up to 25 MB are supported."
            : code || "upload failed",
      );
    } finally {
      setUploadingAssets(false);
    }
  };

  const removeAsset = (uri: string) => {
    setPendingAssets((prev) => {
      const target = prev.find((a) => a.uri === uri);
      if (target?.localPreview) URL.revokeObjectURL(target.localPreview);
      return prev.filter((a) => a.uri !== uri);
    });
  };

  const dispatchSend = (
    sendConnectionId: string | undefined,
    sendModel: string | undefined,
    thinkingLevel: string | undefined,
    content: string,
    assets: PendingAsset[] = [],
  ): boolean => {
    const ws = wsRef.current;
    if (!sendConnectionId || !sendModel) {
      setError("Pick a connection and model first");
      return false;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("Chat socket is not connected — retrying…");
      return false;
    }

    // Attachments ride the message as markdown links — filename.ext carries the
    // file type; vision models additionally get the bytes server-side.
    const fullContent = assets.length > 0 ? `${content}\n\n${assets.map((a) => `[${a.filename}](${a.uri})`).join("\n")}` : content;

    setError(null);
    setDraft("");
    setPendingAssets([]);
    lastSentRef.current = fullContent;
    lastConnectionRef.current = sendConnectionId;
    lastModelRef.current = sendModel;
    lastThinkingRef.current = thinkingLevel;
    setStreaming("");
    setLiveTools([]);
    setStatusText(null);
    setOptimistic({
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: fullContent,
      meta: assets.length > 0 ? { images: assets.map(({ uri, filename, contentType }) => ({ uri, filename, contentType })) } : null,
      createdAt: new Date().toISOString(),
    });
    ws.send(
      JSON.stringify({
        type: "send",
        content: fullContent,
        connectionId: sendConnectionId,
        model: sendModel,
        thinkingLevel,
        ...(assets.length > 0 ? { assets: assets.map(({ uri, filename, contentType }) => ({ uri, filename, contentType })) } : {}),
      }),
    );
    return true;
  };

  const send = (sendConnectionId: string | undefined, sendModel: string | undefined, thinkingLevel?: string, contentOverride?: string): boolean => {
    const content = (contentOverride ?? draft).trim();
    if (!content || compacting) return false;
    // While a round is running, messages go to the steering queue — they're
    // dispatched when the run finishes (or immediately via "send now").
    if (streaming !== null) {
      const assets = contentOverride === undefined ? pendingAssets : [];
      setSteering((prev) => [...prev, { id: `steer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, content, assets }]);
      setDraft("");
      setPendingAssets([]);
      return true;
    }
    if (!sendConnectionId || !sendModel) {
      setError("Pick a connection and model first");
      return false;
    }
    // "/btw <question>" opens a side thread with another agent — never dispatched.
    if (content === "/btw" || content.startsWith("/btw ")) {
      setDraft("");
      setBtw({ sessionId: "", seed: content.slice(4).trim() || undefined });
      return true;
    }
    // "/compact [instructions]" never reaches the model as a prompt — it triggers
    // the compaction flow and the server replays summary + kept context next turn.
    if (content === "/compact" || content.startsWith("/compact ")) {
      if (!sendConnectionId || !sendModel) {
        setError("Pick a connection and model first");
        return false;
      }
      setDraft("");
      void compact(sendConnectionId, sendModel, content.slice("/compact".length).trim());
      return true;
    }
    // "/clear" cuts history off — a boundary like compaction, minus the summary.
    if (content === "/clear") {
      setDraft("");
      void clearContext();
      return true;
    }
    // "/<skill-name>" expands to the skill's full content as the user message —
    // stored skills come from the DB cache, repo skills stream from the runner.
    if (content.startsWith("/")) {
      const name = content.slice(1).trim();
      if (name) {
        const dbSkill = dbSkills.data?.find((s) => s.name === name);
        if (dbSkill) {
          setDraft("");
          return dispatchSend(sendConnectionId, sendModel, thinkingLevel, dbSkill.content);
        }
        if (directoryId && repoSkills.data?.skills.some((s) => s.name === name)) {
          setDraft("");
          setStatusText(`loading skill ${name}…`);
          void api<{ name: string; content: string }>(`/api/code/directories/${directoryId}/repo-skills/${encodeURIComponent(name)}`)
            .then((r) => dispatchSend(sendConnectionId, sendModel, thinkingLevel, r.content))
            .catch((e) => setError((e as Error).message || "skill not found"))
            .finally(() => setStatusText(null));
          return true;
        }
      }
    }
    return dispatchSend(sendConnectionId, sendModel, thinkingLevel, content, pendingAssets);
  };

  const stop = () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && streaming !== null) {
      ws.send(JSON.stringify({ type: "stop" }));
      setAskUser(null);
      setStatusText("stopping…");
      return;
    }
    // Question restored from the transcript with no live run (e.g. after a
    // server restart) — cancel it over REST so history stays valid.
    if (askUser) {
      void api(`/api/code/sessions/${sessionId}/ask-answer`, {
        method: "POST",
        body: JSON.stringify({ toolCallId: askUser.id, cancelled: true }),
      })
        .catch(() => {})
        .finally(() => {
          setAskUser(null);
          invalidateAfterRun();
        });
    }
  };

  /** Pushes all queued steering messages as one user turn. The server aborts
   * an active run only via {type:"stop"} — after that, a plain send starts a
   * new run. Draining happens in the ws.onmessage "done"/"run_state" paths,
   * so the queue is only touched after the run actually ended. */
  const flushSteering = (connectionId: string | undefined, model: string | undefined, thinkingLevelArg?: string) => {
    const items = steeringRef.current;
    if (items.length === 0 || drainRef.current) return;
    const ws = wsRef.current;
    if (!connectionId || !model || !ws || ws.readyState !== WebSocket.OPEN) return; // keep queued — retry when the socket recovers
    drainRef.current = true;
    try {
      // One user message: the queued texts joined, attachments merged. All
      // items belong to the same turn so the model sees them together.
      const content = items.map((i) => i.content).join("\n\n");
      const assets = items.flatMap((i) => i.assets);
      setSteering([]);
      dispatchSend(connectionId, model, thinkingLevelArg, content, assets);
    } finally {
      drainRef.current = false;
    }
  };

  /** Queued steering fires the moment a run finishes — no user action needed. */
  const drainSteeringAfterRun = () => {
    if (steeringRef.current.length === 0) return;
    const connectionId = lastConnectionRef.current;
    const model = lastModelRef.current;
    if (!connectionId || !model) return;
    flushSteering(connectionId, model, lastThinkingRef.current);
  };

  // The single drain point: whenever no run is live but steering messages are
  // queued, dispatch them as one turn. Covers run-done, stop, busy-rejection
  // fallback, anything that ends a run.
  useEffect(() => {
    if (streaming !== null || askUser || drainRef.current) return;
    drainSteeringAfterRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming, steering, askUser]);

  /** Submits wizard answers — resolves the agent's pending ask_user call. */
  const answerAskUser = (answers: AskUserAnswer[]) => {
    if (!askUser) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ask_user_response", id: askUser.id, answers }));
      setAskUser(null);
      return;
    }
    // Socket gone (refresh race) — the endpoint resolves a live loop or
    // repairs the dangling tool_use so the next message continues cleanly.
    void api(`/api/code/sessions/${sessionId}/ask-answer`, { method: "POST", body: JSON.stringify({ toolCallId: askUser.id, answers }) })
      .then(() => setAskUser(null))
      .catch((e) => setError((e as Error).message || "failed to submit answers"))
      .finally(() => invalidateAfterRun());
  };

  /** Fires the steering queue immediately: halts the run, and the drain effect
   * dispatches the queued messages once the run actually stops (streaming
   * clears). If nothing is running, the effect fires on the next tick. */
  const sendSteeringNow = () => {
    if (steeringRef.current.length === 0) return;
    if (streaming !== null) stop();
    // streaming is already null → the drain effect runs on the steering dep.
  };

  const removeSteering = (id: string) => setSteering((prev) => prev.filter((s) => s.id !== id));

  /** /btw finish: summarize (sendToMain) or just close, lock the btw session,
   * and hand the result to the main thread. Server handles the LLM round +
   * main-session insert; the ws on the btw session carries it. */
  const btwDone = (sendToMain: boolean) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("Chat socket is not connected — retrying…");
      return;
    }
    const connId = lastConnectionRef.current;
    const model = lastModelRef.current;
    if (sendToMain && (!connId || !model)) {
      setError("Pick a connection and model first");
      return;
    }
    setStatusText(sendToMain ? "summarizing…" : "closing…");
    ws.send(JSON.stringify({ type: "btw_done", sendToMain, ...(sendToMain && connId && model ? { connectionId: connId, model } : {}) }));
  };

  return {
    session,
    draft,
    setDraft,
    streaming,
    liveTools,
    error,
    wsStatus,
    statusText,
    round,
    thinking,
    thinkingLive,
    thinkingStartedAt,
    thinkingDurationMs,
    optimistic,
    compacting,
    askUser,
    answerAskUser,
    pendingAssets,
    uploadingAssets,
    uploadAssets,
    removeAsset,
    stats,
    gitStatus,
    skillCommands,
    send,
    stop,
    steering,
    sendSteeringNow,
    removeSteering,
    // /btw side thread
    btw,
    startBtw,
    closeBtw,
    openBtwSession,
    btwDone,
    // pagination
    visibleMessages: messages,
    hasOlder,
    loadingOlder,
    loadOlder,
  };
}

export const ChatContext = createContext<ReturnType<typeof useChatPanel> | null>(null);

export function useChat() {
  const chat = useContext(ChatContext);
  if (!chat) throw new Error("useChat must be used within ChatContext");
  return chat;
}
