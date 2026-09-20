import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { codeRepo, sessionStreamUrl } from "../lib/api";
import type { CodeSessionEvent, CreateSessionRequest } from "../../shared/api";

export function useCodeData() {
  const queryClient = useQueryClient();

  const sessionsQuery = useQuery({
    queryKey: ["code", "sessions"],
    queryFn: () => codeRepo.listSessions(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["code"] });

  const createSession = useMutation({
    mutationFn: (body: CreateSessionRequest) => codeRepo.createSession(body),
    onSuccess: invalidate,
  });

  const removeSession = useMutation({
    mutationFn: (id: string) => codeRepo.deleteSession(id),
    onSuccess: invalidate,
  });

  const useSessionDetail = (sessionId: string | null) =>
    useQuery({
      queryKey: ["code", "session", sessionId],
      queryFn: () => codeRepo.getSession(sessionId as string),
      enabled: sessionId != null,
    });

  return { sessionsQuery, createSession, removeSession, useSessionDetail };
}

export function useSessionStream(sessionId: string | null) {
  const [events, setEvents] = useState<CodeSessionEvent[]>([]);
  const [running, setRunning] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  const close = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  useEffect(() => {
    close();
    setEvents([]);
    if (!sessionId) return;

    const source = new EventSource(sessionStreamUrl(sessionId));
    sourceRef.current = source;
    source.onmessage = (message) => {
      let event: CodeSessionEvent;
      try {
        event = JSON.parse(message.data) as CodeSessionEvent;
      } catch {
        return;
      }
      setEvents((prev) => [...prev, event]);
      if (event.type === "run_started") setRunning(true);
      if (event.type === "run_finished") setRunning(false);
    };
    return close;
  }, [sessionId, close]);

  const send = useCallback(
    async (message: string) => {
      if (!sessionId) return;
      setRunning(true);
      try {
        await codeRepo.runSession(sessionId, message);
      } catch {
        setRunning(false);
      }
    },
    [sessionId],
  );

  return { events, running, send };
}
