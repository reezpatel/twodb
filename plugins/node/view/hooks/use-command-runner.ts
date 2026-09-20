import { useCallback, useEffect, useRef, useState } from "react";
import { nodeRepo, commandStreamUrl } from "../lib/api";
import type { TwodbNodeCommandEvent, TwodbNodeCommand } from "../../shared/api";

type Segment = { stream: "stdout" | "stderr"; text: string };

export function useCommandRunner() {
  const [command, setCommand] = useState<TwodbNodeCommand | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const closeStream = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  useEffect(() => closeStream, [closeStream]);

  const appendChunk = (event: TwodbNodeCommandEvent) => {
    if (event.type !== "chunk") return;
    setSegments((prev) => {
      const last = prev.at(-1);
      if (last && last.stream === event.stream) {
        return [...prev.slice(0, -1), { stream: event.stream, text: last.text + event.data }];
      }
      return [...prev, { stream: event.stream, text: event.data }];
    });
  };

  const consume = useCallback(
    (commandId: string) => {
      const source = new EventSource(commandStreamUrl(commandId));
      sourceRef.current = source;
      source.onmessage = (message) => {
        let event: TwodbNodeCommandEvent;
        try {
          event = JSON.parse(message.data) as TwodbNodeCommandEvent;
        } catch {
          return;
        }
        appendChunk(event);
        if (event.type === "exit" || event.type === "error") {
          setRunning(false);
          setCommand((prev) => {
            if (!prev) return prev;
            if (event.type === "error") {
              return { ...prev, status: "error", error: event.error, finished_at: event.at };
            }
            if (event.type === "exit") {
              return { ...prev, status: "done", exit_code: event.code, finished_at: event.at };
            }
            return prev;
          });
          closeStream();
        }
      };
      source.onerror = () => {
        setRunning(false);
        closeStream();
      };
    },
    [closeStream],
  );

  const run = useCallback(
    async (nodeId: string, input: string, cwd: string | null) => {
      closeStream();
      setSegments([]);
      setError(null);
      setRunning(true);
      try {
        const response = await nodeRepo.runCommand(nodeId, { command: input, cwd });
        setCommand(response.command);
        consume(response.command.id);
      } catch (err) {
        setRunning(false);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [closeStream, consume],
  );

  const kill = useCallback(async () => {
    if (!command) return;
    try {
      await nodeRepo.killCommand(command.id);
    } catch {
      // stream close will settle the state
    }
  }, [command]);

  const reset = useCallback(() => {
    closeStream();
    setCommand(null);
    setSegments([]);
    setError(null);
    setRunning(false);
  }, [closeStream]);

  return { command, segments, running, error, run, kill, reset };
}
