import type { SessionDetail } from "../../../lib/artisan-client.js";
import type { ChildSession, GitInfo } from "../hooks/useSessionSide.js";
import { SideSection, PlanRow, SubagentRow, GitFileRow } from "./SidePanel.js";

export interface SessionSidebarProps {
  plan: SessionDetail["plan"];
  children: ChildSession[];
  git: GitInfo | null;
  onOpenChild: (sessionId: string) => void;
}

/** Right sidebar (legacy code sidebar): Plan, Subagents, Skills hint, Git. */
export function SessionSidebar(props: SessionSidebarProps) {
  const plan = props.plan ?? [];
  const done = plan.filter((s) => s.status === "done").length;
  const git = props.git;

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

      <SideSection title="Git" defaultOpen={Boolean(git?.git)}>
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
          </>
        )}
      </SideSection>
    </div>
  );
}
