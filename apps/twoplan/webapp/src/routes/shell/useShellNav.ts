import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { FolderKanban, Inbox, UserCheck, ListChecks, Layers, Milestone, FileText, LayoutDashboard, Settings } from "lucide-react";
import type { NavGroupData } from "@twodb/blocks";
import { useNotifications, useProjects, useSpaces } from "../../lib/queries";

/** Holding hook for the shell: nav tree (spaces -> projects -> sections) + routing. Item ids are route paths. */
export function useShellNav() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { data: projects = [] } = useProjects();
  const { data: spaces = [] } = useSpaces();
  const { data: notes } = useNotifications();

  const groups = useMemo<NavGroupData[]>(() => {
    const out: NavGroupData[] = [
      { heading: "Workspace", items: [
        { id: "/", title: "Projects", icon: FolderKanban },
        { id: "/my", title: "My work", icon: UserCheck },
        { id: "/inbox", title: "Inbox", icon: Inbox, badge: notes?.unreadCount || undefined },
      ] },
    ];
    for (const space of spaces) {
      const inSpace = projects.filter((p) => p.spaceId === space.id);
      if (!inSpace.length) continue;
      out.push({
        heading: space.name,
        items: inSpace.map((p) => ({
          id: `/p/${p.key}`, title: p.name, icon: FolderKanban,
          children: [
            { id: `/p/${p.key}/tickets`, title: "Tickets", icon: ListChecks },
            { id: `/p/${p.key}/epics`, title: "Epics", icon: Layers },
            { id: `/p/${p.key}/milestones`, title: "Milestones", icon: Milestone },
            { id: `/p/${p.key}/docs`, title: "Docs", icon: FileText },
            { id: `/p/${p.key}/dashboards`, title: "Dashboards", icon: LayoutDashboard },
            { id: `/p/${p.key}/settings`, title: "Settings", icon: Settings },
          ],
        })),
      });
    }
    return out;
  }, [spaces, projects, notes?.unreadCount]);

  // Longest nav id that prefixes the current path wins.
  const ids = groups.flatMap((g) => g.items.flatMap((i) => [i.id, ...(i.children?.map((c) => c.id) ?? [])]));
  const activeId = ids.filter((id) => (id === "/" ? pathname === "/" : pathname === id || pathname.startsWith(id + "/"))).sort((a, b) => b.length - a.length)[0];
  return { groups, activeId, onSelect: (id: string) => nav(id) };
}
