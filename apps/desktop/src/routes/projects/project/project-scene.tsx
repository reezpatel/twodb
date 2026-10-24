import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, CloudDownload } from "lucide-react";
import { useProject, type ProjectDetail } from "../use-projects";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Board } from "./board";
import { Backlog } from "./backlog";
import { Sprints } from "./sprints";
import { Milestones } from "./milestones";
import { ProjectSettings } from "./settings";
import { TicketSheet, TicketPageBody } from "./ticket-sheet";

export type Tab = "board" | "backlog" | "sprints" | "milestones" | "settings";

/** /apps/projects/:projectId — the project workspace: subproject switcher,
 * tabs (board/backlog/sprints/milestones/settings), ticket side sheet. */
const TABS: Tab[] = ["board", "backlog", "sprints", "milestones", "settings"];

export function ProjectScene() {
  const { projectId, tab: tabParam, ticketId } = useParams<{ projectId: string; tab?: string; ticketId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const detail = useProject(projectId);
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "board";
  const [syncing, setSyncing] = useState(false);

  const subprojects = detail.data?.subprojects ?? [];
  const subParam = searchParams.get("sub");
  const effectiveSubproject = useMemo(() => subprojects.find((s) => s.id === subParam)?.id, [subprojects, subParam]);
  // ?ticket=<id> opens the ticket sheet (quick view over the board); the
  // /ticket/:ticketId route renders the full-page view with the Properties sidebar.
  const openTicketId = searchParams.get("ticket");

  const setTab = (t: Tab) => navigate({ pathname: `/apps/projects/${projectId}/${t}`, search: subParam ? `?sub=${subParam}` : "" });
  const setSubproject = (v: string) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (v === "all") next.delete("sub");
      else next.set("sub", v);
      return next;
    });

  // A stale ?sub (deleted subproject) falls back to "all".
  useEffect(() => {
    if (subParam && detail.data && !detail.data.subprojects.some((sp) => sp.id === subParam)) setSubproject("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subParam, detail.data]);

  if (detail.isPending) return <div className="text-muted-foreground p-6 text-sm">loading…</div>;
  if (detail.isError) return <div className="text-destructive p-6 text-sm">{detail.error.message}</div>;
  const d = detail.data as ProjectDetail;

  const sync = async () => {
    setSyncing(true);
    try {
      await api(`/api/projects/sync/${d.project.id}/pull`, { method: "POST" });
      void queryClient.invalidateQueries({ queryKey: ["projects", d.project.id] });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate("/apps/projects")} title="All projects">
          <ArrowLeft size={14} />
        </Button>
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
          style={{ backgroundColor: d.project.color ?? "#6366f1" }}
        >
          {d.project.key.slice(0, 2)}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold">{d.project.name}</h1>
            {d.project.externalSource && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                <CloudDownload size={9} className="mr-1" /> {d.project.externalSource}
              </Badge>
            )}
          </div>
          <span className="text-muted-foreground font-mono text-[10px]">{d.project.key}</span>
        </div>
        <div className="ml-2">
          <Select value={subParam ?? "all"} onValueChange={setSubproject}>
            <SelectTrigger className="h-7 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subprojects</SelectItem>
              {subprojects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {d.project.externalSource && (
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={syncing} onClick={() => void sync()}>
              <CloudDownload size={12} className={syncing ? "animate-pulse" : ""} /> {syncing ? "Syncing…" : "Sync now"}
            </Button>
          )}
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="h-7">
              <TabsTrigger value="board" className="h-6 px-2.5 text-xs">
                Board
              </TabsTrigger>
              <TabsTrigger value="backlog" className="h-6 px-2.5 text-xs">
                Backlog
              </TabsTrigger>
              <TabsTrigger value="sprints" className="h-6 px-2.5 text-xs">
                Sprints
              </TabsTrigger>
              <TabsTrigger value="milestones" className="h-6 px-2.5 text-xs">
                Milestones
              </TabsTrigger>
              <TabsTrigger value="settings" className="h-6 px-2.5 text-xs">
                Settings
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {ticketId ? (
          <TicketPageBody ticketId={ticketId} detail={d} onClose={() => navigate(`/apps/projects/${d.project.id}`)} />
        ) : (
          <>
            {tab === "board" && <Board detail={d} subprojectId={effectiveSubproject} />}
            {tab === "backlog" && <Backlog detail={d} subprojectId={effectiveSubproject} />}
            {tab === "sprints" && <Sprints detail={d} subprojectId={effectiveSubproject} />}
            {tab === "milestones" && <Milestones detail={d} />}
            {tab === "settings" && <ProjectSettings detail={d} />}
          </>
        )}
      </div>
      <TicketSheet
        ticketId={openTicketId}
        detail={d}
        open={!!openTicketId}
        onClose={() =>
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete("ticket");
            return next;
          })
        }
      />
    </div>
  );
}
