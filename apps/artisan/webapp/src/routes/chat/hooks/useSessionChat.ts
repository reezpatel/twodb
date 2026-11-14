import { useCallback, useEffect, useRef, useState } from "react";
import { artisanClient, type MessageInfo, type SessionDetail, type UsageInfo } from "../../../lib/artisan-client.js";
import { useWorkspaceWs } from "../../../lib/workspace-ws.js";

/**
 * Live session state: initial fetch + WS frame application for one joined
 * session. Streams deltas into a pending assistant bubble, tool events into
 * the transcript, ask_user into an inline widget, usage into the footer.
 */
export function useSessionChat(sessionId: string) {
  const { socket, onFrame } = useWorkspaceWs();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const [thinking, setThinking] = useState("");
  const [toolEvents, setToolEvents] = useState<Array<{ id: string; name: string; args: Record<string, unknown>; output?: string; ok?: boolean }>>([]);
  const [ask, setAsk] = useState<{ askId: string; questions: Array<{ question: string; options?: string[]; allowMultiple?: boolean }> } | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [queue, setQueue] = useState<Array<{ id: string; content: string }>>([]);
  const scroller = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await artisanClient.getSession(sessionId);
      setDetail(d);
      setUsage(d.usage);
      setRunning(d.running);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
    setStreamText("");
    setToolEvents([]);
    setAsk(null);
    setQueue([]);
    socket.send({ type: "join", sessionId });
    return () => socket.send({ type: "leave", sessionId });
  }, [sessionId, refresh, socket]);

  const doSend = useCallback(async (text: string) => {
    setStreamText("");
    setRunning(true);
    try {
      await artisanClient.sendMessage(sessionId, text);
      // messages arrive via WS frames; also poke the transcript for the user row
      void refresh();
    } catch (e) {
      setError((e as Error).message);
      setRunning(false);
    }
  }, [sessionId, refresh]);

  const flushQueue = useCallback(() => {
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      queueMicrotask(() => void doSend(first.content));
      return rest;
    });
  }, [doSend]);

  /** Sends text, or queues it while a run is in flight (legacy code-chat-queue). */
  const send = useCallback(async (text: string) => {
    if (running) {
      setQueue((prev) => [...prev, { id: crypto.randomUUID(), content: text }]);
      return;
    }
    await doSend(text);
  }, [running, doSend]);

  const removeQueued = useCallback((id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }, []);

  /** Send a queued message now: move it to the front, stop the current run. */
  const sendQueuedNow = useCallback((id: string) => {
    setQueue((prev) => {
      const item = prev.find((q) => q.id === id);
      if (!item) return prev;
      return [item, ...prev.filter((q) => q.id !== id)];
    });
    void artisanClient.abort(sessionId);
  }, [sessionId]);

  useEffect(() => {
    const off = onFrame((frame) => {
      if (frame.sessionId !== sessionId) return;
      switch (frame.type) {
        case "run_start":
          setRunning(true);
          setStreamText("");
          setToolEvents([]);
          break;
        case "delta":
          setStreamText((prev) => prev + String(frame.text ?? ""));
          break;
        case "thinking_delta":
          setThinking((prev) => prev + String(frame.text ?? ""));
          break;
        case "tool_start":
          setToolEvents((prev) => [...prev, { id: String(frame.id), name: String(frame.name), args: (frame.args as Record<string, unknown>) ?? {} }]);
          break;
        case "tool_result":
          setToolEvents((prev) => prev.map((t) => (t.id === frame.id ? { ...t, output: String(frame.output ?? ""), ok: Boolean(frame.ok) } : t)));
          break;
        case "message_done":
          setStreamText("");
          setThinking("");
          void refresh();
          break;
        case "ask_user":
          setAsk({ askId: String(frame.askId), questions: (frame.questions as NonNullable<typeof ask>["questions"]) ?? [] });
          break;
        case "ask_resolved":
          setAsk(null);
          break;
        case "usage":
          setUsage(frame.usage as UsageInfo);
          break;
        case "status":
          setStatus(String(frame.text ?? ""));
          break;
        case "session_renamed":
          setDetail((d) => (d ? { ...d, title: String(frame.title) } : d));
          break;
        case "plan":
          setDetail((d) => (d ? { ...d, plan: (frame.plan as SessionDetail["plan"]) ?? null } : d));
          break;
        case "compaction_done":
          setStatus(`context summarized (${String(frame.summary ?? "").length} chars)`);
          void refresh();
          break;
        case "error":
          setError(String(frame.message ?? "error"));
          break;
        case "done":
          setRunning(false);
          setStatus(null);
          void refresh();
          flushQueue();
          break;
      }
    });
    return off;
  }, [onFrame, sessionId, refresh, flushQueue]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [streamText, toolEvents.length, detail?.messages.length]);


  const answer = useCallback((askId: string, answers: Array<string | string[]>) => {
    socket.send({ type: "answer", sessionId, askId, answers });
  }, [sessionId, socket]);

  const cancelAsk = useCallback((askId: string) => {
    socket.send({ type: "cancel", sessionId, askId });
  }, [sessionId, socket]);

  const newThread = useCallback(async () => {
    await artisanClient.newThread(sessionId);
    void refresh();
  }, [sessionId, refresh]);

  /** /clear — drop prior context by starting a fresh thread (same as /new). */
  const clearThread = useCallback(async () => {
    await artisanClient.newThread(sessionId);
    void refresh();
  }, [sessionId, refresh]);

  const compact = useCallback(async () => {
    await artisanClient.compact(sessionId);
    void refresh();
  }, [sessionId, refresh]);

  const abort = useCallback(async () => {
    await artisanClient.abort(sessionId);
  }, [sessionId]);

  return {
    detail, error, running, status, streamText, thinking, toolEvents, ask, usage,
    queue,
    messages: detail?.messages ?? [] as MessageInfo[],
    scroller, send, removeQueued, sendQueuedNow, answer, cancelAsk, newThread, clearThread, compact, abort, refresh,
  };
}
