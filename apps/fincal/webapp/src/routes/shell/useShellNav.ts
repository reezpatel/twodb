import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { LayoutDashboard, Receipt, Landmark, PiggyBank, Mail, Target, TrendingUp, Scale, Hourglass, BarChart3, Calculator, Settings, Wallet } from "lucide-react";
import type { NavGroupData } from "@twodb/blocks";
import { useSpaces } from "../../lib/queries";

export const SECTIONS = [
  { path: "overview", title: "Overview", icon: LayoutDashboard },
  { path: "transactions", title: "Transactions", icon: Receipt },
  { path: "accounts", title: "Accounts & cards", icon: Landmark },
  { path: "budgets", title: "Budgets", icon: PiggyBank },
  { path: "envelopes", title: "Envelopes", icon: Mail },
  { path: "goals", title: "Goals", icon: Target },
  { path: "investments", title: "Investments", icon: TrendingUp },
  { path: "networth", title: "Net worth", icon: Scale },
  { path: "retirement", title: "Retirement", icon: Hourglass },
  { path: "analytics", title: "Analytics", icon: BarChart3 },
  { path: "calculators", title: "Calculators", icon: Calculator },
  { path: "settings", title: "Settings", icon: Settings },
];

/** Holding hook for the shell: spaces -> sections nav tree. Every member sees every space. Item ids are route paths. */
export function useShellNav() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { data: spaces = [] } = useSpaces();

  const groups = useMemo<NavGroupData[]>(() => [
    { heading: "Fincal", items: [{ id: "/", title: "All spaces", icon: Wallet }] },
    { heading: "Spaces", items: spaces.map((s) => ({
      id: `/s/${s.id}`, title: s.name, icon: Wallet,
      children: SECTIONS.map((x) => ({ id: `/s/${s.id}/${x.path}`, title: x.title, icon: x.icon })),
    })) },
  ], [spaces]);

  const ids = groups.flatMap((g) => g.items.flatMap((i) => [i.id, ...(i.children?.map((c) => c.id) ?? [])]));
  const activeId = ids.filter((id) => (id === "/" ? pathname === "/" : pathname === id || pathname.startsWith(id + "/"))).sort((a, b) => b.length - a.length)[0];
  return { groups, activeId, onSelect: (id: string) => nav(id) };
}
