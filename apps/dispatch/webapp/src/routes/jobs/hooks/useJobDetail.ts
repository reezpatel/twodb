import { useCallback, useEffect, useRef, useState } from "react";
import { dispatchClient, type Job, type JobLogLine } from "../../../lib/dispatch-client.js";

/**
 * Business hook for the job detail page: the job record, its live-tailed
 * log (SSE while running, buffered snapshot otherwise), stdin feed and
 * terminate mutations.
 */
export function useJobDetail(id: string) {
  const [job, setJob] = useState<Job | null>(null);
  const [lines, setLines] = useState<JobLogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seenSeq = useRef(0);

  const mergeLine = useCallback((l: JobLogLine) => {
    if (l.seq <= seenSeq.current) return;
    seenSeq.current = l.seq;
    setLines((prev) => [...prev, l]);
  }, []);

  const load = useCallback(async () => {
    try {
      const [j, tail] = await Promise.all([dispatchClient.getJob(id), dispatchClient.jobTail(id, 1000)]);
      setJob(j);
      seenSeq.current = 0;
      setLines(tail.lines);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  // Initial load, then either live-follow (running) or gentle polling.
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!job || job.status !== "running") return;
    const stop = dispatchClient.tailFollow(id, mergeLine, () => void load());
    return stop;
  }, [id, job?.status, mergeLine, load]);

  const sendInput = useCallback(
    async (input: { data?: string; eof?: boolean }) => {
      setInputError(null);
      try {
        await dispatchClient.jobInput(id, input);
      } catch (e) {
        setInputError((e as Error).message);
      }
    },
    [id],
  );

  const terminate = useCallback(async () => {
    setBusy(true);
    try {
      await dispatchClient.terminateJob(id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [id, load]);

  return { job, lines, error, inputError, busy, sendInput, terminate, reload: load };
}
