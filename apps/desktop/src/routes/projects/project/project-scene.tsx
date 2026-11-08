import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ChevronRight, CloudDownload } from "lucide-react";
import { useProject, type ProjectDetail } from "../use-projects";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Overview } from "./overview";
import { Board } from "./board";
import { Backlog } from "./backlog";
import { Sprints } from "./sprints";
import { Milestones } from "./milestones";
import { ProjectSettings } from "./settings";
import { TicketSheet, TicketPageBody } from "./ticket-sheet";

export type Tab = "overview" | "board" | "backlog" | "sprints" | "milestones" | "settings";

/** /apps/projects/:projectId — the project workspace: subproject switcher,
 * tabs (board/backlog/sprints/milestones/settings), ticket side sheet. */
const TABS: Tab[] = ["overview", "board", "backlog", "sprints", "milestones", "settings"];

export function ProjectScene() {
  const { projectId, tab: tabParam, ticketId } = useParams<{ projectId: string; tab?: string; ticketId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const detail = useProject(projectId);
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "overview";
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

  const tabLabels: Record<Tab, string> = {
    overview: "Overview",
    board: "Board",
    backlog: "Backlog",
    sprints: "Sprints",
    milestones: "Milestones",
    settings: "Settings",
  };

  return (
    <div className="flex h-full flex-col">
      <div className="bg-background border-b px-8 pt-5">
        <nav className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs">
          <button className="hover:text-foreground transition-colors" onClick={() => navigate("/apps/projects")}>
            Projects
          </button>
          <ChevronRight size={12} />
          <span className="text-foreground">{d.project.name}</span>
        </nav>
        <div className="flex items-center gap-4 pb-4">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: d.project.color ?? "#6366f1" }}
          >
            {d.project.icon ?? d.project.key.slice(0, 2)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-lg font-semibold tracking-tight">{d.project.name}</h1>
              <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-mono text-[11px]">{d.project.key}</span>
              {d.project.externalSource && (
                <Badge variant="outline" className="h-5 gap-1 px-2 text-[11px]">
                  <CloudDownload size={11} /> {d.project.externalSource}
                </Badge>
              )}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {d.project.externalSource && (
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={syncing} onClick={() => void sync()}>
                <CloudDownload size={13} className={syncing ? "animate-pulse" : ""} /> {syncing ? "Syncing…" : "Sync now"}
              </Button>
            )}
            {tab !== "milestones" && tab !== "settings" && (
              <Select value={subParam ?? "all"} onValueChange={setSubproject}>
                <SelectTrigger className="h-8 w-48 text-xs">
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
            )}
          </div>
        </div>
        <nav className="-mb-px flex items-center gap-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t && !ticketId}
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 px-3 pt-1 pb-2.5 text-sm transition-colors",
                tab === t && !ticketId
                  ? "border-primary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:border-border border-transparent",
              )}
            >
              {tabLabels[t]}
            </button>
          ))}
        </nav>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {ticketId ? (
          <TicketPageBody ticketId={ticketId} detail={d} onClose={() => navigate(`/apps/projects/${d.project.id}`)} />
        ) : (
          <>
            {tab === "overview" && <Overview detail={d} subprojectId={effectiveSubproject} />}
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
