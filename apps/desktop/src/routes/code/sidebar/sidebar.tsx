import { useState } from "react";
import { Bot, Check, ChevronUp, Circle, Flag, Folder, GitBranch, Link, Loader2, RefreshCw, Tag, User, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChat } from "../chat/use-chat-panel";
import type { BackgroundJob } from "../chat/use-chat-panel";
import { useSessionDirectory } from "../chat/use-session-directory";
import { useGitStatus } from "../directories/use-git-status";

const WORKFLOW_ITEMS = [
  { id: "backlog", label: "Backlog", icon: Circle },
  { id: "labels", label: "Labels", icon: Tag },
  { id: "deps", label: "Dependencies", icon: Link },
  { id: "assignee", label: "Ava Elizabeth", icon: User },
];

const SESSION_ITEMS = [
  { id: "api", label: "api", icon: Folder },
  { id: "worktree", label: "No worktree", icon: GitBranch },
  { id: "flag", label: "1 flag", icon: Flag },
];

const MEMORIES = [
  { id: "m1", text: "Repo uses pnpm + Kysely; migrations in apps/server/migrations.", scope: "project" },
  { id: "m2", text: "API on :3001, desktop dev on :5173 via /api proxy.", scope: "project" },
  { id: "m3", text: "Runners connect outbound; never expose runner ports.", scope: "global" },
];

const SECTIONS = ["subagents", "jobs", "memories", "workflow", "session", "plan", "git"] as const;
type SectionId = (typeof SECTIONS)[number];

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-b last:border-b-0">
      <button className="hover:bg-accent/50 flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium" onClick={onToggle}>
        {title}
        <ChevronUp size={16} className={cn("text-muted-foreground transition-transform", !open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function SidebarItem({ icon: Icon, children }: { icon: typeof Circle; children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground flex items-center gap-2 py-1 text-sm">
      <Icon size={14} aria-hidden="true" />
      <span className="truncate">{children}</span>
    </div>
  );
}

/** Real git summary for the selected session's directory: branch line from
 * git-status, changed files from git-changes. Both are invalidated by the
 * chat panel after a run (the footer gitStatus frame already does this). */
export interface GitChangeFile {
  path: string;
  status: string;
  additions: number | null;
  deletions: number | null;
}

function useSidebarGit() {
  const queryClient = useQueryClient();
  const { directoryId } = useSessionDirectory();
  const status = useGitStatus(directoryId);
  const changes = useQuery({
    queryKey: ["code", "directories", directoryId, "changes"],
    queryFn: () => api<{ git: boolean; files: GitChangeFile[] }>(`/api/code/directories/${directoryId}/git-changes`),
    enabled: !!directoryId && status.data?.git === true,
    retry: false,
  });
  const isNoGit = (status.data && status.data.git === false) || (changes.data && changes.data.git === false);

  return {
    hasDirectory: !!directoryId,
    isPending: status.isPending || (status.data?.git === true && changes.isPending),
    isError: status.isError || changes.isError,
    isRefetching: status.isFetching || changes.isFetching,
    errorText: status.isError ? (status.error instanceof Error ? status.error.message : "failed to load") : "failed to load changes",
    isNoGit,
    branch: status.data?.branch ?? "—",
    ahead: status.data?.ahead ?? null,
    behind: status.data?.behind ?? null,
    files: changes.data?.git === true ? changes.data.files : [],
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: ["code", "directories", directoryId, "git"] });
      void queryClient.invalidateQueries({ queryKey: ["code", "directories", directoryId, "changes"] });
    },
  };
}

/** Background jobs (run_background tool) — REST fetch on mount; afterwards the
 * session ws "jobs" frames write straight into this query's cache (see
 * use-chat-panel), which this query observes. */
function useSidebarJobs() {
  const { session } = useChat();
  const sessionId = session.data?.id ?? null;
  const jobs = useQuery({
    queryKey: ["code", "session", sessionId, "jobs"],
    queryFn: () => api<{ jobs: BackgroundJob[] }>(`/api/code/sessions/${sessionId}/jobs`).then((r) => r.jobs ?? []),
    enabled: !!sessionId,
    // A running job's exit arrives as a ws push, not a poll — but a refocus
    // refetch is cheap and heals any missed frame.
    refetchOnWindowFocus: true,
  });
  return { jobs: jobs.data ?? [], isPending: jobs.isPending };
}

function JobRow({ job }: { job: BackgroundJob }) {
  const { session } = useChat();
  const sessionId = session.data?.id ?? null;
  const kill = useMutation({
    mutationFn: () => api(`/api/code/sessions/${sessionId}/jobs/${job.id}/kill`, { method: "POST" }),
  });
  const icon =
    job.status === "running" ? (
      <Loader2 size={12} className="text-primary shrink-0 animate-spin" aria-hidden="true" />
    ) : (
      <Circle
        size={12}
        className={cn(
          "shrink-0",
          job.status === "done" && "text-success",
          job.status === "failed" && "text-destructive",
          (job.status === "lost" || job.status === "killed") && "text-muted-foreground",
        )}
        aria-hidden="true"
      />
    );
  return (
    <div className="bg-muted/40 flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left text-xs">
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[11px]" title={job.command}>
          {job.command}
        </span>
        <span className="text-muted-foreground block font-mono text-[10px]">
          {job.id.slice(0, 8)} · {job.status}
          {job.exitCode !== null && ` · exit ${job.exitCode}`}
          {job.status === "running" && " · use job_logs for output"}
        </span>
      </span>
      {job.status === "running" && (
        <button
          className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded p-1"
          title="Kill job"
          aria-label="Kill job"
          onClick={(e) => {
            e.stopPropagation();
            kill.mutate();
          }}
        >
          {kill.isPending ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <X size={11} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}

/** Child sessions (subagents + /btw) of the current session, with live running
 * state. Polls while any child runs so the sidebar shows live progress. */
function useSidebarSubagents() {  const { session } = useChat();
  const sessionId = session.data?.id ?? null;
  const children = useQuery({
    queryKey: ["code", "session", sessionId, "children"],
    queryFn: () =>
      api<
        {
          id: string;
          title: string;
          locked: boolean;
          interactive: boolean;
          depthCount: number;
          updatedAt: string;
          running: boolean;
        }[]
      >(`/api/code/sessions?type=sub_agent&parentSessionId=${sessionId}`),
    enabled: !!sessionId,
    refetchInterval: (q) => ((q.state.data as { running: boolean }[] | undefined)?.some((c) => c.running) ? 2000 : false),
  });
  const anyRunning = (children.data ?? []).some((c) => c.running);
  return {
    children: children.data ?? [],
    isPending: children.isPending,
    anyRunning,
    refetch: children.refetch,
  };
}

export function Sidebar() {
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    subagents: true,
    jobs: true,
    memories: true,
    workflow: false,
    session: true,
    plan: true,
    git: true,
  });
  const toggle = (id: SectionId) => setOpen((cur) => ({ ...cur, [id]: !cur[id] }));

  const git = useSidebarGit();
  const subagents = useSidebarSubagents();
  const backgroundJobs = useSidebarJobs();
  const { openBtwSession, session } = useChat();
  const planSteps = (session.data?.plan as { steps?: { description: string; status: string }[] } | null | undefined)?.steps ?? [];

  return (
    <div className="flex h-full flex-col">
      <Section
        title={`Subagents${subagents.children.length ? ` (${subagents.children.length})` : ""}`}
        open={open.subagents}
        onToggle={() => toggle("subagents")}
      >
        {subagents.isPending ? (
          <div className="text-muted-foreground py-1 text-xs">loading…</div>
        ) : subagents.children.length === 0 ? (
          <div className="text-muted-foreground py-1 text-xs">none — invoke_subagent or /btw spawns one</div>
        ) : (
          <div className="flex flex-col gap-1">
            {subagents.children.map((child) => (
              <button
                key={child.id}
                className="bg-muted/40 hover:bg-accent/50 flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors"
                onClick={() => openBtwSession(child.id)}
                title="Open the session — live while it runs"
              >
                {child.running ? (
                  <Loader2 size={12} className="text-primary shrink-0 animate-spin" aria-hidden="true" />
                ) : (
                  <Bot size={12} className="text-muted-foreground shrink-0" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{child.title}</span>
                  <span className="text-muted-foreground block font-mono text-[10px]">
                    d{child.depthCount} · {child.locked ? "closed" : child.running ? "running" : "idle"}
                    {!child.interactive && " · headless"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section
        title={`Jobs${backgroundJobs.jobs.length ? ` (${backgroundJobs.jobs.filter((j) => j.status === "running").length} active)` : ""}`}
        open={open.jobs}
        onToggle={() => toggle("jobs")}
      >
        {backgroundJobs.isPending ? (
          <div className="text-muted-foreground py-1 text-xs">loading…</div>
        ) : backgroundJobs.jobs.length === 0 ? (
          <div className="text-muted-foreground py-1 text-xs">none — run_background starts detached jobs</div>
        ) : (
          <div className="flex flex-col gap-1">
            {backgroundJobs.jobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Memories" open={open.memories} onToggle={() => toggle("memories")}>
        <div className="flex flex-col gap-2">
          {MEMORIES.map((memory) => (
            <div key={memory.id} className="bg-muted rounded-md p-2 text-xs">
              <p>{memory.text}</p>
              <span className="text-muted-foreground/70 mt-1 block font-mono text-[10px] uppercase">{memory.scope}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Workflow" open={open.workflow} onToggle={() => toggle("workflow")}>
        {WORKFLOW_ITEMS.map((item) => (
          <SidebarItem key={item.id} icon={item.icon}>
            {item.label}
          </SidebarItem>
        ))}
      </Section>

      <Section title="Session" open={open.session} onToggle={() => toggle("session")}>
        {SESSION_ITEMS.map((item) => (
          <SidebarItem key={item.id} icon={item.icon}>
            {item.label}
          </SidebarItem>
        ))}
      </Section>

      <Section title={`Plan${planSteps.length ? ` (${planSteps.filter((s) => s.status === "done").length}/${planSteps.length})` : ""}`} open={open.plan} onToggle={() => toggle("plan")}>
        {planSteps.length === 0 ? (
          <div className="text-muted-foreground py-1 text-xs">no plan set — the agent calls update_plan for multi-step work</div>
        ) : (
          <ol className="flex flex-col gap-1">
            {planSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 py-0.5 text-xs" title={step.status}>
                <span
                  className={cn(
                    "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border text-[9px]",
                    step.status === "done"
                      ? "border-success text-success"
                      : step.status === "in_progress"
                        ? "border-primary text-primary"
                        : "text-muted-foreground",
                  )}
                >
                  {step.status === "done" ? <Check size={9} aria-hidden="true" /> : step.status === "in_progress" ? <Loader2 size={9} className="animate-spin" aria-hidden="true" /> : i + 1}
                </span>
                <span className={cn("min-w-0 flex-1", step.status === "done" && "text-muted-foreground line-through")}>{step.description}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title={`Git Summary${git.files ? ` (${git.files.length})` : ""}`} open={open.git} onToggle={() => toggle("git")}>
        {git.isError ? (
          <div className="text-destructive flex items-center gap-2 py-1 text-xs">
            <GitBranch size={14} aria-hidden="true" /> {git.errorText}
          </div>
        ) : !git.hasDirectory ? (
          <div className="text-muted-foreground py-1 text-xs">select a session</div>
        ) : git.isPending ? (
          <div className="text-muted-foreground py-1 text-xs">loading…</div>
        ) : git.isNoGit ? (
          <div className="text-muted-foreground py-1 text-xs">not a git repository</div>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2 text-sm">
              <GitBranch size={14} aria-hidden="true" />
              <span className="truncate font-mono">{git.branch}</span>
              {git.ahead !== null && (
                <span className={cn("font-mono text-xs", git.ahead > 0 && "text-success")}>
                  {git.ahead > 0 ? `↑${git.ahead}` : "0"}
                  {git.behind !== null && git.behind > 0 ? ` ↓${git.behind}` : ""}
                </span>
              )}
              <Button variant="ghost" size="icon-sm" className="ml-auto" title="Refresh" onClick={git.refresh}>
                <RefreshCw size={12} className={git.isRefetching ? "animate-spin" : undefined} />
              </Button>
            </div>
            {git.files.map((file) => (
              <div key={file.path + file.status} className="flex items-center gap-2 py-0.5 text-sm">
                <span
                  className={cn("font-mono text-xs", file.status === "U" ? "text-muted-foreground" : "text-warning")}
                  title={
                    {
                      M: "modified",
                      A: "added",
                      D: "deleted",
                      R: "renamed",
                      C: "copied",
                      U: "untracked",
                    }[file.status] ?? file.status
                  }
                >
                  {file.status}
                </span>
                <span className="truncate font-mono text-xs" title={file.path}>
                  {file.path}
                </span>
                <span className="ml-auto shrink-0 font-mono text-xs">
                  {file.additions !== null && <span className="text-success">+{file.additions}</span>}{" "}
                  {file.deletions !== null && <span className="text-destructive">-{file.deletions}</span>}
                </span>
              </div>
            ))}
          </>
        )}
      </Section>
    </div>
  );
}
