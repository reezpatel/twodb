import type { ReactNode } from "react";
import { Avatar, PriorityIcon, StatusIcon, TypeIcon } from "../../components/Visuals";
import { PRIORITIES } from "../../lib/meta";
import type { Epic, GroupBy, Member, Milestone, ProjectConfig, Ticket } from "../../lib/types";

export interface Group { id: string; label: string; icon?: ReactNode; tickets: Ticket[] }

interface Deps { config: ProjectConfig; members: Member[]; epics: Epic[]; milestones: Milestone[] }

/** Splits tickets into ordered groups (every defined bucket is returned, even empty ones, for status). */
export function groupTickets(tickets: Ticket[], by: GroupBy | null, d: Deps): Group[] {
  if (!by) return [{ id: "all", label: "All tickets", tickets }];
  const buckets: Omit<Group, "tickets">[] = [];
  let key: (t: Ticket) => string | null;
  switch (by) {
    case "status": key = (t) => t.statusId; d.config.statuses.forEach((s) => buckets.push({ id: s.id, label: s.name, icon: <StatusIcon category={s.category} color={s.color} /> })); break;
    case "priority": key = (t) => t.priority ?? "none"; [...PRIORITIES.map((p) => ({ id: p.id as string, label: p.label, icon: <PriorityIcon priority={p.id} /> })), { id: "none", label: "No priority", icon: <PriorityIcon priority={null} /> }].forEach((b) => buckets.push(b)); break;
    case "assignee": key = (t) => t.assigneeUserId ?? "none"; d.members.forEach((m) => buckets.push({ id: m.id, label: m.name, icon: <Avatar name={m.name} image={m.image} size={16} /> })); buckets.push({ id: "none", label: "Unassigned" }); break;
    case "type": key = (t) => t.typeId ?? "none"; d.config.ticketTypes.forEach((x) => buckets.push({ id: x.id, label: x.name, icon: <TypeIcon icon={x.icon} color={x.color} /> })); buckets.push({ id: "none", label: "No type" }); break;
    case "epic": key = (t) => t.epicId ?? "none"; d.epics.forEach((e) => buckets.push({ id: e.id, label: e.title })); buckets.push({ id: "none", label: "No epic" }); break;
    case "milestone": key = (t) => t.milestoneId ?? "none"; d.milestones.forEach((m) => buckets.push({ id: m.id, label: m.name })); buckets.push({ id: "none", label: "No milestone" }); break;
  }
  const map = new Map<string, Ticket[]>(buckets.map((b) => [b.id, []]));
  for (const t of tickets) { const k = key(t) ?? "none"; (map.get(k) ?? map.set(k, []).get(k)!).push(t); }
  return buckets.filter((b) => by === "status" || (map.get(b.id)?.length ?? 0) > 0).map((b) => ({ ...b, tickets: map.get(b.id) ?? [] }));
}
