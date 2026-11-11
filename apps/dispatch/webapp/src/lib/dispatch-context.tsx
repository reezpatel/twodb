import { createContext, useContext, type ReactNode } from "react";
import { useRunners } from "../routes/runners/hooks/useRunners.js";
import { useJobs } from "../routes/jobs/hooks/useJobs.js";
import { useMicrovms } from "../routes/microvms/hooks/useMicrovms.js";

/**
 * One shared instance of each domain's state at the app level (runners,
 * jobs, microvms) — the same pattern as TwoRoute's connections context: a
 * mutation in any view refreshes what every other view sees.
 */
interface DispatchState {
  runners: ReturnType<typeof useRunners>;
  jobs: ReturnType<typeof useJobs>;
  microvms: ReturnType<typeof useMicrovms>;
}

const DispatchContext = createContext<DispatchState | null>(null);

export function DispatchProvider({ children }: { children: ReactNode }) {
  const runners = useRunners();
  const jobs = useJobs();
  const microvms = useMicrovms();
  return <DispatchContext.Provider value={{ runners, jobs, microvms }}>{children}</DispatchContext.Provider>;
}

export function useSharedDispatch(): DispatchState {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error("useSharedDispatch must be used inside <DispatchProvider>");
  return ctx;
}
