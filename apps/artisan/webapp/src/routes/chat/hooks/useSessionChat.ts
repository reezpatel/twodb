import { useCallback, useEffect, useRef, useState } from "react";
import { artisanClient, type AskInfo, type MessageInfo, type QueueItemInfo, type SessionDetail, type UsageInfo } from "../../../lib/artisan-client.js";
import { useWorkspaceWs } from "../../../lib/workspace-ws.js";

/**
 * Live session state: initial fetch + WS frame application for one joined
 * session. Streams deltas into a pending assistant bubble, tool events into
 * the transcript, ask_user into an inline widget, usage into the footer.
 *
 * The steering queue and the active ask_user live on the SERVER (see
 * session-runner.ts): messages typed while a run is in flight are POSTed and
 * queued there, so a client disconnect/reload loses nothing, every viewer
 * sees the same queue, and a client that (re)joins while a question is open
 * gets it via the WS state frame / session fetch and shows the dialog again.
 */
export function useSessionChat(sessionId: string) {
  const { socket, onFrame } = useWorkspaceWs();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const [thinking, setThinking] = useState("");
  const [toolEvents, setToolEvents] = useState<Array<{ id: string; name: string; args: Record<string, unknown>; output?: string; ok?: boolean }>>([]);
  const [ask, setAsk] = useState<AskInfo | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [compacting, setCompacting] = useState(false);
  const [queue, setQueue] = useState<QueueItemInfo[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  /** Set until the first state frame/refresh arrives: a live ask from the
   * server must win over optimistic local clears after a reconnect. */
  const syncedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const d = await artisanClient.getSession(sessionId);
      setDetail(d);
      setUsage(d.usage);
      setRunning(d.running);
      setQueue(d.queue);
      if (d.ask) setAsk(d.ask);
      syncedRef.current = true;
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
    syncedRef.current = false;
    socket.send({ type: "join", sessionId });
    return () => socket.send({ type: "leave", sessionId });
  }, [sessionId, refresh, socket]);

  /** Sends text — queued server-side while a run is in flight. */
  const send = useCallback(async (text: string) => {
    if (!running) setStreamText("");
    try {
      await artisanClient.sendMessage(sessionId, text);
      // run_start / queue come back via WS frames; also poke for the user row
      void refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }, [sessionId, running, refresh]);

  const removeQueued = useCallback((id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
    void artisanClient.removeQueuedMessage(sessionId, id).catch(() => void refresh());
  }, [sessionId, refresh]);

  /** Send the queued messages now: the server aborts the current run and
   * dispatches the queue the moment the run ends. */
  const sendQueueNow = useCallback(() => {
    void artisanClient.sendQueueNow(sessionId).catch((e) => setError((e as Error).message));
  }, [sessionId]);

  useEffect(() => {
    const off = onFrame((frame) => {
      if (frame.sessionId !== sessionId) return;
      switch (frame.type) {
        case "state": {
          // Catch-up on (re)join: the server's runtime state is authoritative
          // — a run started while this client was away, the shared queue, and
          // an ask_user question still waiting for an answer.
          setRunning(Boolean(frame.running));
          setQueue((frame.queue as QueueItemInfo[]) ?? []);
          const serverAsk = (frame.ask as AskInfo | null) ?? null;
          if (serverAsk) setAsk(serverAsk);
          else if (!syncedRef.current) setAsk(null);
          syncedRef.current = true;
          void refresh();
          break;
        }
        case "run_start":
          setRunning(true);
          setQueue([]);
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
          // Swap the streamed text for the saved message in one render, so the
          // text never disappears (or shows twice) while the transcript reloads.
          void artisanClient.getSession(sessionId).then((d) => {
            setDetail(d);
            setUsage(d.usage);
            setRunning(d.running);
            setQueue(d.queue);
            setStreamText("");
            setThinking("");
          }).catch(() => { setStreamText(""); setThinking(""); });
          break;
        case "ask_user":
          setAsk({ askId: String(frame.askId), questions: (frame.questions as AskInfo["questions"]) ?? [] });
          break;
        case "ask_resolved":
          setAsk(null);
          break;
        case "usage":
          setUsage(frame.usage as UsageInfo);
          break;
        case "status":
          if (/compacting/i.test(String(frame.text ?? ""))) setCompacting(true);
          else setStatus(String(frame.text ?? ""));
          break;
        case "new_thread":
          void refresh();
          break;
        case "session_renamed":
          setDetail((d) => (d ? { ...d, title: String(frame.title) } : d));
          break;
        case "plan":
          setDetail((d) => (d ? { ...d, plan: (frame.plan as SessionDetail["plan"]) ?? null } : d));
          break;
        case "compaction_done":
          setCompacting(false);
          setStatus(null);
          void refresh();
          break;
        case "error":
          setError(String(frame.message ?? "error"));
          break;
        case "done":
          // The run is over the moment this frame lands — clear `running`
          // synchronously so the composer stops steering right away. Queued
          // messages are dispatched server-side (done → drain there).
          setRunning(false);
          setCompacting(false);
          setStatus(null);
          // Saved messages now carry every tool call — drop the live copies once loaded.
          void artisanClient.getSession(sessionId).then((d) => {
            setDetail(d);
            setUsage(d.usage);
            setQueue(d.queue);
            setToolEvents([]);
            setStreamText("");
            setThinking("");
          }).catch(() => { setToolEvents([]); });
          break;
      }
    });
    return off;
  }, [onFrame, sessionId, refresh]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [streamText, toolEvents.length, detail?.messages.length]);


  const answer = useCallback((askId: string, answers: Array<string | string[]>) => {
    socket.send({ type: "answer", sessionId, askId, answers });
    // Clear immediately instead of waiting for the ask_resolved echo — a fresh
    // ask_user frame re-opens the widget if the agent asks again.
    setAsk(null);
  }, [sessionId, socket]);

  const cancelAsk = useCallback((askId: string) => {
    socket.send({ type: "cancel", sessionId, askId });
    setAsk(null);
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
    setCompacting(true);
    try {
      await artisanClient.compact(sessionId);
    } finally {
      setCompacting(false);
    }
    void refresh();
  }, [sessionId, refresh]);

  /** Unsend a message: it and everything after it are deleted server-side. */
  const unsend = useCallback(async (messageId: string) => {
    try {
      await artisanClient.unsendMessage(sessionId, messageId);
      void refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }, [sessionId, refresh]);

  const abort = useCallback(async () => {
    // Optimistic: the server clears the steering queue and ends the run; the
    // queue pills and spinner must not wait for the done frame (which may be
    // delayed while a stalled provider stream is torn down).
    setQueue([]);
    try {
      await artisanClient.abort(sessionId);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [sessionId]);

  return {
    detail, error, running, compacting, status, streamText, thinking, toolEvents, ask, usage,
    queue,
    messages: detail?.messages ?? [] as MessageInfo[],
    scroller, send, removeQueued, sendQueueNow, unsend, answer, cancelAsk, newThread, clearThread, compact, abort, refresh,
  };
}

