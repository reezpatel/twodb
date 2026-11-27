import type { SessionDetail, SessionPrLink } from "../../../lib/artisan-client.js";
import type { ChildSession, JobRow as JobRowT } from "../hooks/useSessionSide.js";
import { SideSection, SubagentRow, JobRow } from "./SidePanel.js";
import { MemoriesSection } from "./MemoriesSection.js";
import { ProviderSection } from "./ProviderSection.js";
import { PrSection } from "./PrSection.js";
import { NotesSection } from "./NotesSection.js";
import { PlanList, type PlanStep } from "../../../components/ui/plan-list.js";

export interface SessionSidebarProps {
  sessionId: string;
  model: string | null;
  prs: SessionPrLink[];
  plan: SessionDetail["plan"];
  children: ChildSession[];
  jobs: JobRowT[];
  onOpenChild: (sessionId: string) => void;
}

/** Right sidebar (legacy code sidebar): Plan, Subagents, Skills hint, Git. */
export function SessionSidebar(props: SessionSidebarProps) {
  const plan = props.plan ?? [];
  const done = plan.filter((s) => s.status === "done").length;
  const planSteps: PlanStep[] = plan.map((s, i) => ({
    id: `step-${i}`,
    title: s.description,
    activeTitle: s.description,
    status: s.status === "in_progress" ? "in_progress" : s.status === "done" ? "done" : s.status === "blocked" ? "blocked" : s.status === "failed" ? "failed" : "pending",
  }));
  return (
    <div data-slot="session-sidebar" className="flex h-full min-h-0 w-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
      {props.children.length > 0 ? (
        <SideSection title="Subagents" count={props.children.length}>
          {props.children.map((c) => (
            <SubagentRow key={c.id} title={c.title} running={c.running} adhoc={c.adhoc} onClick={() => props.onOpenChild(c.id)} />
          ))}
        </SideSection>
      ) : null}

      <SideSection title="Plan" count={plan.length ? `${done}/${plan.length}` : undefined}>
        <PlanList items={planSteps} hideHeader hideProgress collapsible={false} empty="No plan yet — the agent uses update_plan." />
      </SideSection>

      <MemoriesSection sessionId={props.sessionId} />

      <PrSection sessionId={props.sessionId} prs={props.prs} />

      <NotesSection sessionId={props.sessionId} />

      {props.jobs.length > 0 ? (
        <SideSection title="Background jobs" count={props.jobs.length}>
          {props.jobs.map((j) => (
            <JobRow key={j.id} command={j.command} status={j.status} exitCode={j.exitCode} />
          ))}
        </SideSection>
      ) : null}
      </div>

      {/* Footer: provider quotas, pinned below the scrolling sections. */}
      <div data-slot="session-sidebar-footer" className="max-h-[45%] shrink-0 overflow-y-auto border-t border-outline">
        <ProviderSection model={props.model} />
      </div>
    </div>
  );
}
