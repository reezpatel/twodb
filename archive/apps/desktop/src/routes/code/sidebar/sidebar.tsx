import { useState } from "react";
import { Circle, Flag, Folder, GitBranch, Link, Tag, User } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CodeMemories, type CodeMemory, type CodeMemoryGroup } from "@/components/blocks/code/code-sidebar/code-memories";
import { CodeBackgroundJobs, type CodeBackgroundJob } from "@/components/blocks/code/code-sidebar/code-background-jobs";
import { CodeSubagents, type CodeSubagent } from "@/components/blocks/code/code-sidebar/code-subagents";
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
  const stop = useMutation({
    mutationFn: (jobId: string) => api(`/api/code/sessions/${sessionId}/jobs/${jobId}/kill`, { method: "POST" }),
  });
  return {
    jobs: jobs.data ?? [],
    isPending: jobs.isPending,
    stop: (jobId: string) => stop.mutate(jobId),
    stoppingId: stop.isPending ? (stop.variables ?? null) : null,
  };
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

/** Subagents and jobs as block items; the logs tail is fetched only while a row is expanded. */
function toSubagentItems(children: ReturnType<typeof useSidebarSubagents>["children"]): CodeSubagent[] {
  return children.map((child) => ({
    id: child.id,
    title: child.title,
    status: child.locked ? "closed" : child.running ? "running" : "idle",
    detail: `depth ${child.depthCount} · ${child.locked ? "closed" : child.running ? "running" : "idle"}${child.interactive ? "" : " · headless"}`,
  }));
}

const JOB_STATUS: Record<BackgroundJob["status"], CodeBackgroundJob["status"]> = {
  running: "running",
  done: "done",
  failed: "failed",
  killed: "stopped",
  lost: "stopped",
};

function toJobItems(jobs: BackgroundJob[], stoppingId: string | null): CodeBackgroundJob[] {
  return jobs.map((job) => ({
    id: job.id,
    command: job.command,
    status: JOB_STATUS[job.status],
    detail: `${job.id.slice(0, 8)} · ${job.status}${job.exitCode !== null ? ` · exit ${job.exitCode}` : ""}`,
    stopping: stoppingId === job.id,
  }));
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
  const sessionId = session.data?.id ?? null;
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
            <CodeSubagents subagents={toSubagentItems(subagents.children)} onSelect={openBtwSession} />
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
            <CodeBackgroundJobs
              jobs={toJobItems(backgroundJobs.jobs, backgroundJobs.stoppingId)}
              onStop={backgroundJobs.stop}
              renderLogs={(job) => (sessionId ? <JobLogs sessionId={sessionId} jobId={job.id} running={job.status === "running"} /> : null)}
            />
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
