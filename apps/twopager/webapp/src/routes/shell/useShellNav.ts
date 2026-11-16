import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { Globe, LayoutGrid } from "lucide-react";
import type { NavGroupData } from "@twodb/blocks";
import { useSpaces } from "../../lib/queries";

/** Holding hook for the shell: spaces -> nav tree. Item ids are route paths. */
export function useShellNav() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { data: spaces = [] } = useSpaces();

  const groups = useMemo<NavGroupData[]>(() => [
    { heading: "TwoPager", items: [{ id: "/", title: "All spaces", icon: LayoutGrid }] },
    { heading: "Spaces", items: spaces.map((s) => ({ id: `/s/${s.id}`, title: s.name, icon: Globe })) },
  ], [spaces]);

  const ids = groups.flatMap((g) => g.items.map((i) => i.id));
  const activeId = ids.filter((id) => (id === "/" ? pathname === "/" : pathname === id || pathname.startsWith(id + "/"))).sort((a, b) => b.length - a.length)[0];
  return { groups, activeId, onSelect: (id: string) => nav(id) };
}
