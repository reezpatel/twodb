import { useState } from "react";
import { Bot, Circle, Flag, Folder, GitBranch, Link, Loader2, Tag, User, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CodeMemories, type CodeMemory, type CodeMemoryGroup } from "@/components/blocks/code/code-sidebar/code-memories";
import { CodeSidebarSection } from "@/components/blocks/code/code-sidebar/code-sidebar-section";
import {
  CodeCommit,
  CodeCommitActions,
  CodeCommitBranch,
  CodeCommitContent,
  CodeCommitCounts,
  CodeCommitFile,
  CodeCommitFolder,
  CodeCommitHeader,
  CodeCommitMessage,
  CodeCommitRefreshAction,
  CodeCommitTitle,
  CodeCommitTrigger,
} from "@/components/blocks/code/code-sidebar/code-commit";
import { CodePlan, type CodePlanItem, type CodePlanItemStatus } from "@/components/blocks/code/code-sidebar/code-plan";
import { useChat } from "../chat/use-chat-panel";
import type { BackgroundJob } from "../chat/use-chat-panel";
import { useSidebarGit } from "./use-sidebar-git";

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

interface SessionMemory {
  id: string;
  title: string;
  content: string;
  scope: "organization" | "code_directory" | "agent" | "session";
}

/** Organization → Global, code directory → Project; the agent's own and session-bound memories are Local. */
const MEMORY_GROUPS: Record<SessionMemory["scope"], CodeMemoryGroup> = {
  organization: "global",
  code_directory: "project",
  agent: "local",
  session: "local",
};

/** The memories this session's agent sees: organization + directory + its own (a subagent's are its caller's). */
function useSidebarMemories() {
  const { session } = useChat();
  const sessionId = session.data?.id ?? null;
  const queryClient = useQueryClient();
  const queryKey = ["code", "session", sessionId, "memories"];
  const memories = useQuery({
    queryKey,
    queryFn: () => api<SessionMemory[]>(`/api/memories/applicable?sessionId=${sessionId}`),
    enabled: !!sessionId,
    // Agents add memories mid-run via tools; a light poll plus refocus keeps the list current.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const forget = useMutation({
    mutationFn: (id: string) => api(`/api/memories/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });
  const items: CodeMemory[] = (memories.data ?? []).map((m) => ({ id: m.id, title: m.title, content: m.content, group: MEMORY_GROUPS[m.scope] }));
  return { items, isPending: memories.isPending, forget: (id: string) => forget.mutate(id) };
}

function toPlanStatus(status: string): CodePlanItemStatus {
  if (status === "done") return "completed";
  if (status === "in_progress") return "in-progress";
  return "pending";
}

const SECTIONS = ["subagents", "jobs", "memories", "workflow", "session", "plan", "git"] as const;
type SectionId = (typeof SECTIONS)[number];

function SidebarItem({ icon: Icon, children }: { icon: typeof Circle; children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground flex items-center gap-2 py-1 text-sm">
      <Icon size={14} aria-hidden="true" />
      <span className="truncate">{children}</span>
    </div>
  );
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

/** Logs for one background job — expands inside the row. Polls while running. */
function JobLogs({ sessionId, jobId, running }: { sessionId: string; jobId: string; running: boolean }) {
  const logs = useQuery({
    queryKey: ["code", "session", sessionId, "jobs", jobId, "logs"],
    queryFn: () => api<{ output: string }>(`/api/code/sessions/${sessionId}/jobs/${jobId}/logs?lines=100`).then((r) => r.output),
    refetchInterval: running ? 3000 : false,
    refetchOnWindowFocus: true,
    retry: false,
  });
  if (logs.isPending) return <div className="text-muted-foreground px-2 py-1.5 text-[10px]">loading logs…</div>;
  if (logs.isError)
    return <div className="text-destructive px-2 py-1.5 text-[10px]">{logs.error instanceof Error ? logs.error.message : "failed to load logs"}</div>;
  return (
    <pre className="text-muted-foreground max-h-64 overflow-auto px-2 py-1.5 font-mono text-[10px] whitespace-pre-wrap">{logs.data ?? "(no output yet)"}</pre>
  );
}

function JobRow({ job }: { job: BackgroundJob }) {
  const { session } = useChat();
  const sessionId = session.data?.id ?? null;
  const [logsOpen, setLogsOpen] = useState(false);
  const kill = useMutation({
    mutationFn: () => api(`/api/code/sessions/${sessionId}/jobs/${job.id}/kill`, { method: "POST" }),
  });
  const running = job.status === "running";
  const icon = running ? (
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
    <div className="bg-muted/40 w-full rounded-md border text-left text-xs">
      <button
        className="hover:bg-accent/50 flex w-full items-start gap-2 rounded-md px-2 py-1.5"
        onClick={() => setLogsOpen((v) => !v)}
        title={logsOpen ? "Hide logs" : "Show logs"}
      >
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[11px]" title={job.command}>
            {job.command}
          </span>
          <span className="text-muted-foreground block font-mono text-[10px]">
            {job.id.slice(0, 8)} · {job.status}
            {job.exitCode !== null && ` · exit ${job.exitCode}`}
          </span>
        </span>
        {running && (
          <span
            role="button"
            className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded p-1"
            title="Stop job"
            aria-label="Stop job"
            onClick={(e) => {
              e.stopPropagation();
              kill.mutate();
            }}
          >
            {kill.isPending ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <X size={11} aria-hidden="true" />}
          </span>
        )}
      </button>
      {logsOpen && sessionId && <JobLogs sessionId={sessionId} jobId={job.id} running={running} />}
    </div>
  );
}

/** Child sessions (subagents + /btw) of the current session, with live running
 * state. Polls while any child runs so the sidebar shows live progress. */
function useSidebarSubagents() {
  const { session } = useChat();
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
  const showGitTotals = git.hasDirectory && !git.isNoGit && !git.isError && !git.isPending && git.fileCount > 0;
  const gitTitle = showGitTotals ? `${git.fileCount} changed ${git.fileCount === 1 ? "file" : "files"}` : "Git Summary";
  const memories = useSidebarMemories();
  const subagents = useSidebarSubagents();
  const backgroundJobs = useSidebarJobs();
  const { openBtwSession, session } = useChat();
  const planSteps = (session.data?.plan as { steps?: { description: string; status: string }[] } | null | undefined)?.steps ?? [];
  const planItems: CodePlanItem[] = planSteps.map((step, index) => ({ id: String(index), title: step.description, status: toPlanStatus(step.status) }));

  return (
    <div className="flex h-full flex-col">
      {(subagents.children.length > 0 || subagents.isPending) && (
        <CodeSidebarSection
          title={`Subagents${subagents.children.length ? ` (${subagents.children.length})` : ""}`}
          open={open.subagents}
          onOpenChange={() => toggle("subagents")}
        >
          {subagents.isPending ? (
            <div className="text-muted-foreground py-1 text-xs">loading…</div>
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
        </CodeSidebarSection>
      )}

      {(backgroundJobs.jobs.length > 0 || backgroundJobs.isPending) && (
        <CodeSidebarSection
          title={`Jobs${backgroundJobs.jobs.length ? ` (${backgroundJobs.jobs.filter((j) => j.status === "running").length} active)` : ""}`}
          open={open.jobs}
          onOpenChange={() => toggle("jobs")}
        >
          {backgroundJobs.isPending ? (
            <div className="text-muted-foreground py-1 text-xs">loading…</div>
          ) : (
            <div className="flex flex-col gap-1">
              {backgroundJobs.jobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          )}
        </CodeSidebarSection>
      )}

      <CodeSidebarSection title="Memories" count={memories.items.length || undefined} open={open.memories} onOpenChange={() => toggle("memories")}>
        <CodeMemories memories={memories.items} onRemove={memories.forget} />
      </CodeSidebarSection>

      <CodeSidebarSection title="Workflow" open={open.workflow} onOpenChange={() => toggle("workflow")}>
        {WORKFLOW_ITEMS.map((item) => (
          <SidebarItem key={item.id} icon={item.icon}>
            {item.label}
          </SidebarItem>
        ))}
      </CodeSidebarSection>

      <CodeSidebarSection title="Session" open={open.session} onOpenChange={() => toggle("session")}>
        {SESSION_ITEMS.map((item) => (
          <SidebarItem key={item.id} icon={item.icon}>
            {item.label}
          </SidebarItem>
        ))}
      </CodeSidebarSection>

      <CodePlan items={planItems} open={open.plan} onOpenChange={(next) => setOpen((cur) => ({ ...cur, plan: next }))} className="border-b" />

      <CodeCommit open={open.git} onOpenChange={(next) => setOpen((cur) => ({ ...cur, git: next }))}>
        <CodeCommitHeader>
          <CodeCommitTrigger>
            <CodeCommitTitle>{gitTitle}</CodeCommitTitle>
            {showGitTotals ? <CodeCommitCounts additions={git.additions} deletions={git.deletions} className="ml-auto" /> : null}
          </CodeCommitTrigger>
          {git.hasDirectory && !git.isNoGit ? (
            <CodeCommitActions>
              <CodeCommitRefreshAction spinning={git.isRefetching} onClick={git.refresh} />
            </CodeCommitActions>
          ) : null}
        </CodeCommitHeader>
        <CodeCommitContent>
          {git.isError ? (
            <CodeCommitMessage tone="destructive">{git.errorText}</CodeCommitMessage>
          ) : !git.hasDirectory ? (
            <CodeCommitMessage>select a session</CodeCommitMessage>
          ) : git.isPending ? (
            <CodeCommitMessage>loading…</CodeCommitMessage>
          ) : git.isNoGit ? (
            <CodeCommitMessage>not a git repository</CodeCommitMessage>
          ) : (
            <>
              <CodeCommitBranch name={git.branch} ahead={git.ahead} behind={git.behind} />
              {git.fileCount === 0 ? <CodeCommitMessage>No changes — working tree clean.</CodeCommitMessage> : null}
              {git.groups.map((group) =>
                group.folder ? (
                  <CodeCommitFolder key={group.folder} name={group.folder} additions={group.additions} deletions={group.deletions}>
                    {group.files.map((file) => (
                      <CodeCommitFile key={file.path} nested {...file} />
                    ))}
                  </CodeCommitFolder>
                ) : (
                  group.files.map((file) => <CodeCommitFile key={file.path} {...file} />)
                ),
              )}
            </>
          )}
        </CodeCommitContent>
      </CodeCommit>
    </div>
  );
}
