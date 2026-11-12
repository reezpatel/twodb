import { NavLink, Outlet, useParams } from "react-router";
import { ProjectProvider } from "../../lib/project-context";
import { useConfig, useProject } from "../../lib/queries";
import { EmptyState, Spinner } from "../../components/Visuals";

const TABS = [["tickets", "Tickets"], ["epics", "Epics"], ["milestones", "Milestones"], ["docs", "Docs"], ["dashboards", "Dashboards"], ["settings", "Settings"]] as const;

/** Loads the project + its config once and exposes them through context to every sub-route. */
export function ProjectLayout() {
  const { key = "" } = useParams();
  const { data: project, isLoading, error } = useProject(key);
  const { data: config } = useConfig(key);
  if (isLoading) return <Spinner />;
  if (error || !project) return <EmptyState title="Project not found" hint={`There is no project "${key}" in this workspace.`} />;
  if (!config) return <Spinner />;
  return (
    <ProjectProvider project={project} config={config}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-4 border-b border-outline px-5">
          <div className="flex items-center gap-2 py-2.5"><span className="rounded-sm bg-paper-grid px-1.5 py-0.5 font-mono text-xs">{project.key}</span><span className="text-[15px] font-semibold">{project.name}</span>{project.archivedAt ? <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs text-warning">Archived</span> : null}</div>
          <nav className="flex items-center gap-1 text-sm">
            {TABS.map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `rounded-sm px-2.5 py-2 transition-colors ${isActive ? "text-ink shadow-[inset_0_-2px_0_var(--ink)]" : "text-ink-muted hover:text-ink"}`}>{label}</NavLink>
            ))}
          </nav>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto"><Outlet /></div>
      </div>
    </ProjectProvider>
  );
}
