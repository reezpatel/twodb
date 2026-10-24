import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ChevronDown, CloudDownload, Flag, FolderKanban, Folder, ListTodo, Plus, Settings2, SquareKanban, Zap } from "lucide-react";
import { useProjects, useSubprojects, type Project } from "./use-projects";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

/** App sidenav for /apps/projects: the org's projects + create + sync-link. */
export function ProjectsSidenav() {
  const projects = useProjects();
  const location = useLocation();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [linking, setLinking] = useState(false);

  const activeId = /\/apps\/projects\/([^/]+)/.exec(location.pathname)?.[1];
  const activeTab = /\/apps\/projects\/[^/]+\/([^/?]+)/.exec(location.pathname)?.[1];
  const search = location.search;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-semibold">Projects</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" title="New project" onClick={() => setCreating(true)}>
            <Plus size={14} />
          </Button>
          <Button variant="ghost" size="icon-sm" title="Link from Linear / Plane" onClick={() => setLinking(true)}>
            <CloudDownload size={14} />
          </Button>
        </div>
      </div>
      <Separator />
      <div className="flex-1 overflow-y-auto p-1.5">
        <button
          className={cn(
            "hover:bg-accent/50 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
            location.pathname === "/apps/projects" && "bg-accent",
          )}
          onClick={() => navigate("/apps/projects")}
        >
          <FolderKanban size={14} className="text-muted-foreground shrink-0" />
          All projects
        </button>
        {projects.data?.map((p) => (
          <ProjectTree
            key={p.id}
            project={p}
            expanded={activeId === p.id}
            activeTab={activeTab}
            search={search}
            onOpen={(tab) => navigate(`/apps/projects/${p.id}${tab ? `/${tab}` : ""}`)}
            onOpenSub={(subId, tab) => navigate(`/apps/projects/${p.id}/${tab ?? "board"}?sub=${subId}`)}
          />
        ))}
      </div>
      <NewProjectDialog open={creating} onClose={() => setCreating(false)} />
      <LinkProjectDialog open={linking} onClose={() => setLinking(false)} />
    </div>
  );
}

/** One project in the tree: header row, then project-level views and a
 * subproject group with Board/Backlog per subproject. */
function ProjectTree({
  project,
  expanded,
  activeTab,
  search,
  onOpen,
  onOpenSub,
}: {
  project: Project;
  expanded: boolean;
  activeTab?: string;
  search: string;
  onOpen: (tab?: string) => void;
  onOpenSub: (subId: string, tab?: string) => void;
}) {
  const subprojects = useSubprojects(expanded ? project.id : undefined);
  const activeSub = /[?&]sub=([^&]+)/.exec(search)?.[1];
  const itemCls = (active: boolean) => cn("hover:bg-accent/50 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs", active && "bg-accent");
  return (
    <div>
      <div className={cn("hover:bg-accent/50 flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-sm", expanded && "bg-accent/60")}>
        <button className="flex min-w-0 flex-1 items-center gap-2" onClick={() => onOpen()}>
          <span
            className="flex size-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
            style={{ backgroundColor: project.color ?? "#6366f1" }}
          >
            {project.key.slice(0, 2)}
          </span>
          <span className="min-w-0 flex-1 truncate">{project.name}</span>
          {project.externalSource && <CloudDownload size={11} className="text-muted-foreground shrink-0" />}
        </button>
        <button
          className="text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => onOpen(activeTab)}
          aria-label={expanded ? "collapse" : "expand"}
        >
          <ChevronDown size={12} className={cn("transition-transform", !expanded && "-rotate-90")} />
        </button>
      </div>
      {expanded && (
        <div className="border-border/60 ml-4 border-l pl-1.5">
          <button className={itemCls(activeTab === "sprints")} onClick={() => onOpen("sprints")}>
            <Zap size={11} className="text-muted-foreground" /> Sprints
          </button>
          <button className={itemCls(activeTab === "milestones")} onClick={() => onOpen("milestones")}>
            <Flag size={11} className="text-muted-foreground" /> Milestones
          </button>
          <button className={itemCls(activeTab === "settings")} onClick={() => onOpen("settings")}>
            <Settings2 size={11} className="text-muted-foreground" /> Settings
          </button>
          {subprojects.data?.map((sub) => (
            <div key={sub.id} className="mt-0.5">
              <div className="text-muted-foreground flex items-center gap-1.5 px-2 pt-1 text-[10px] font-semibold tracking-wide uppercase">
                <Folder size={10} /> {sub.name}
              </div>
              <button className={itemCls(activeSub === sub.id && (activeTab === "board" || !activeTab))} onClick={() => onOpenSub(sub.id, "board")}>
                <SquareKanban size={11} className="text-muted-foreground" /> Board
              </button>
              <button className={itemCls(activeSub === sub.id && activeTab === "backlog")} onClick={() => onOpenSub(sub.id, "backlog")}>
                <ListTodo size={11} className="text-muted-foreground" /> Backlog
              </button>
            </div>
          ))}
          {expanded && subprojects.isPending && <div className="text-muted-foreground px-2 py-1 text-[10px]">loading…</div>}
        </div>
      )}
    </div>
  );
}

function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ project: Project }>("/api/projects/projects", { method: "POST", body: JSON.stringify({ name, key }) });
      onClose();
      navigate(`/apps/projects/${res.project.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Web app" autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Identifier key</Label>
            <Input
              value={key}
              onChange={(e) =>
                setKey(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 10),
                )
              }
              placeholder="WEB"
            />
            <p className="text-muted-foreground text-xs">Tickets get identifiers like {key || "WEB"}-12.</p>
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!name.trim() || key.length < 2 || busy} onClick={() => void submit()}>
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Link a Linear/Plane remote project — creates a new synced project. Existing
 * projects can't be linked (config must come from the remote). */
function LinkProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [source, setSource] = useState<"linear" | "plane">("linear");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [remoteId, setRemoteId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ project: Project }>("/api/projects/sync/link", {
        method: "POST",
        body: JSON.stringify({ source, apiKey, ...(source === "plane" ? { baseUrl } : {}), remoteProjectId: remoteId }),
      });
      onClose();
      navigate(`/apps/projects/${res.project.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link from an external tracker</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-xs">
          Creates a new project synced one-way from the remote. Statuses and labels are copied and stay locked; tickets can be pushed back individually.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as "linear" | "plane")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="plane">Plane (self-hosted)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {source === "plane" && (
            <div className="flex flex-col gap-1.5">
              <Label>Base URL</Label>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://plane.example.com" />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>{source === "linear" ? "Linear API key" : "Plane API token"}</Label>
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={source === "linear" ? "lin_api_…" : "plane_api_…"} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{source === "linear" ? "Team key (e.g. ENG)" : "Workspace slug + project id"}</Label>
            <Input value={remoteId} onChange={(e) => setRemoteId(e.target.value)} placeholder={source === "linear" ? "ENG" : "my-workspace/abc-123"} />
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!apiKey.trim() || !remoteId.trim() || (source === "plane" && !baseUrl.trim()) || busy} onClick={() => void submit()}>
              {busy ? "Linking…" : "Link & import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
