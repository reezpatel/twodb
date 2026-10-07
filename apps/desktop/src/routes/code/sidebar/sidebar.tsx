import { useState } from "react";
import { Bot, ChevronUp, Circle, Flag, Folder, GitBranch, Link, Loader2, RefreshCw, Tag, User } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChat } from "../chat/use-chat-panel";
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

const SECTIONS = ["subagents", "memories", "workflow", "session", "git"] as const;
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
    memories: true,
    workflow: false,
    session: true,
    git: true,
  });
  const toggle = (id: SectionId) => setOpen((cur) => ({ ...cur, [id]: !cur[id] }));

  const git = useSidebarGit();
  const subagents = useSidebarSubagents();
  const { openBtwSession } = useChat();

  return (
    <aside className="bg-card border-l hidden h-full w-72 shrink-0 flex-col overflow-y-auto border-l xl:flex">
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
    </aside>
  );
}
