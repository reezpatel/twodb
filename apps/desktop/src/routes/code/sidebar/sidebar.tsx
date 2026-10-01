import { useState } from "react";
import { ChevronUp, Circle, Flag, Folder, GitBranch, Link, RefreshCw, Tag, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

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

const GIT_FILES = [
  { name: "server.ts", additions: 12, deletions: 2 },
  { name: "db.ts", additions: 8, deletions: 1 },
];

const MEMORIES = [
  { id: "m1", text: "Repo uses pnpm + Kysely; migrations in apps/server/migrations.", scope: "project" },
  { id: "m2", text: "API on :3001, desktop dev on :5173 via /api proxy.", scope: "project" },
  { id: "m3", text: "Runners connect outbound; never expose runner ports.", scope: "global" },
];

const USAGE_PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic",
    current: true,
    windows: [
      { label: "5h", used: 42, resets: "15:00" },
      { label: "week", used: 61, resets: "Mon" },
      { label: "month", used: 23, resets: "Jun 1" },
    ],
  },
  {
    id: "glm",
    name: "GLM",
    windows: [
      { label: "5h", used: 87, resets: "14:12" },
      { label: "week", used: 54, resets: "Mon" },
      { label: "month", used: 38, resets: "Jun 1" },
    ],
  },
];

const SECTIONS = ["usage", "memories", "workflow", "session", "git"] as const;
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

export function Sidebar() {
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    usage: true,
    memories: true,
    workflow: false,
    session: true,
    git: true,
  });
  const toggle = (id: SectionId) => setOpen((cur) => ({ ...cur, [id]: !cur[id] }));

  return (
    <aside className="bg-card border-l hidden h-full w-72 shrink-0 flex-col overflow-y-auto border-l xl:flex">
      <Section title="Usage" open={open.usage} onToggle={() => toggle("usage")}>
        <div className="flex flex-col gap-3">
          {USAGE_PROVIDERS.map((provider) => (
            <div key={provider.id}>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                {provider.name}
                {provider.current && (
                  <Badge variant="success" className="text-[10px]">
                    current
                  </Badge>
                )}
              </div>
              {provider.windows.map((window) => (
                <div key={window.label} className="flex items-center gap-2 py-0.5 text-xs">
                  <span className="text-muted-foreground w-10">{window.label}</span>
                  <Progress
                    value={window.used}
                    className={cn(
                      "h-1.5 flex-1",
                      window.used >= 85 ? "[&>[data-slot=indicator]]:bg-destructive" : window.used >= 60 ? "[&>[data-slot=indicator]]:bg-warning" : "",
                    )}
                  />
                  <span className="w-8 text-right">{window.used}%</span>
                  <span className="text-muted-foreground/70 w-12 text-right">↻ {window.resets}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
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

      <Section title={`Git Summary (${GIT_FILES.length})`} open={open.git} onToggle={() => toggle("git")}>
        <div className="mb-2 flex items-center gap-2 text-sm">
          <GitBranch size={14} aria-hidden="true" />
          <span className="font-mono">main</span>
          <Button variant="ghost" size="icon-sm" className="ml-auto" title="Refresh (mock)">
            <RefreshCw size={12} />
          </Button>
        </div>
        {GIT_FILES.map((file) => (
          <div key={file.name} className="flex items-center gap-2 py-0.5 text-sm">
            <span className="text-warning font-mono text-xs">M</span>
            <span className="truncate font-mono text-xs">{file.name}</span>
            <span className="ml-auto font-mono text-xs">
              <span className="text-success">+{file.additions}</span> <span className="text-destructive">-{file.deletions}</span>
            </span>
          </div>
        ))}
      </Section>
    </aside>
  );
}
