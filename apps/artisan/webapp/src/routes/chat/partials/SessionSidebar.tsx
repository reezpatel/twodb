import type { SessionDetail } from "../../../lib/artisan-client.js";
import { useState } from "react";
import type { ChildSession, GitInfo, JobRow as JobRowT } from "../hooks/useSessionSide.js";
import { SideSection, PlanRow, SubagentRow, GitFileRow, JobRow } from "./SidePanel.js";

export interface SessionSidebarProps {
  plan: SessionDetail["plan"];
  children: ChildSession[];
  git: GitInfo | null;
  jobs: JobRowT[];
  busy: boolean;
  onCommit: (message: string) => Promise<string | null>;
  onOpenChild: (sessionId: string) => void;
}

/** Right sidebar (legacy code sidebar): Plan, Subagents, Skills hint, Git. */
export function SessionSidebar(props: SessionSidebarProps) {
  const plan = props.plan ?? [];
  const done = plan.filter((s) => s.status === "done").length;
  const git = props.git;
  const [message, setMessage] = useState("");
  const [commitError, setCommitError] = useState<string | null>(null);
  const dirty = (git?.files ?? []).length > 0;

  const doCommit = async () => {
    const msg = message.trim();
    if (!msg) return;
    setCommitError(null);
    const err = await props.onCommit(msg);
    if (err) setCommitError(err);
    else setMessage("");
  };

  return (
    <div data-slot="session-sidebar" className="flex h-full min-h-0 w-64 shrink-0 flex-col overflow-y-auto border-l border-outline">
      {props.children.length > 0 ? (
        <SideSection title="Subagents" count={props.children.length}>
          {props.children.map((c) => (
            <SubagentRow key={c.id} title={c.title} running={c.running} adhoc={c.adhoc} onClick={() => props.onOpenChild(c.id)} />
          ))}
        </SideSection>
      ) : null}

      <SideSection title="Plan" count={plan.length ? `${done}/${plan.length}` : undefined}>
        {plan.length > 0 ? (
          <ul>
            {plan.map((step, i) => (
              <PlanRow key={i} title={step.description} status={step.status} />
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-ink-muted">No plan yet — the agent uses update_plan.</p>
        )}
      </SideSection>

      <SideSection title="Git" defaultOpen>
        {!git || git.git === false ? (
          <p className="text-[11px] text-ink-muted">not a git repository</p>
        ) : (
          <>
            <p className="mb-1 flex items-center gap-2 font-mono text-[11px]">
              <span className="text-ink">{git.branch}</span>
              {git.additions ? <span className="text-success">+{git.additions}</span> : null}
              {git.deletions ? <span className="text-destructive">−{git.deletions}</span> : null}
            </p>
            {(git.files ?? []).map((f) => (
              <GitFileRow key={f.path} path={f.path} status={f.status} />
            ))}
            {(git.files ?? []).length === 0 ? <p className="text-[11px] text-ink-muted">clean</p> : null}
            <div className="mt-2 flex items-center gap-1.5">
              <input
                value={message}
                placeholder="commit message"
                className="h-7 min-w-0 flex-1 rounded-md border border-outline bg-paper px-2 text-[11px] outline-none placeholder:text-ink-muted"
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void doCommit();
                }}
              />
              <button
                type="button"
                disabled={!dirty || !message.trim() || props.busy}
                className="h-7 shrink-0 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
                onClick={() => void doCommit()}
              >
                Commit
              </button>
            </div>
            {commitError ? <p className="mt-1 text-[10px] text-destructive">{commitError}</p> : null}
          </>
        )}
      </SideSection>

      {props.jobs.length > 0 ? (
        <SideSection title="Background jobs" count={props.jobs.length}>
          {props.jobs.map((j) => (
            <JobRow key={j.id} command={j.command} status={j.status} exitCode={j.exitCode} />
          ))}
        </SideSection>
      ) : null}
    </div>
  );
}
