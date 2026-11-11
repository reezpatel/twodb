import { useCallback, useEffect, useState } from "react";
import { dispatchClient, type Job } from "../../../lib/dispatch-client.js";

/**
 * Business hook: the job list (filterable) + lifecycle mutations. Job
 * detail (tail streaming, stdin feed) is separate so the list stays cheap.
 */
export function useJobs(filter: { runnerId?: string; resourceId?: string; status?: string } = {}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setJobs(await dispatchClient.listJobs(filter));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [filter.resourceId, filter.runnerId, filter.status]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 5_000);
    return () => clearInterval(t);
  }, [refresh]);

  const create = useCallback(
    async (input: { runnerId: string; resourceId?: string; cwd?: string; command: string }) => {
      setBusy(true);
      try {
        return await dispatchClient.createJob(input);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const terminate = useCallback(async (id: string) => {
    setBusy(true);
    try {
      return await dispatchClient.terminateJob(id);
    } finally {
      setBusy(false);
    }
  }, []);

  return { jobs, busy, error, refresh, create, terminate };
}
