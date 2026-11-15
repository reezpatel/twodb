import { useMemo } from "react";
import { ChevronRight, Plus, Shapes } from "lucide-react";
import type { Board, BoardGroup } from "@shared/model";
import { BoardRow } from "./BoardRow";
import type { SidebarTab } from "../hooks/useShell";

export interface BoardListProps {
  tab: SidebarTab;
  collapsed: Record<string, boolean>;
  onToggleSection(id: string): void;
  boards: Board[] | null;
  groups: BoardGroup[];
  spaceName(spaceId: string): string | undefined;
  activeBoardId: string | null;
  onOpen(b: Board): void;
  onRename(b: Board, name: string): Promise<void> | void;
  onDelete(b: Board): Promise<void> | void;
  onNew(): void;
}

interface Section {
  id: string;
  label: string;
  hint: string;
  boards: Board[];
}

/** Boards of one kind grouped into collapsible sections by their group (Artisan-style directory sections). */
export function BoardList(props: BoardListProps) {

  const sections = useMemo<Section[]>(() => {
    if (!props.boards) return [];
    const byGroup = new Map<string, Board[]>();
    for (const b of props.boards) {
      const list = byGroup.get(b.groupId) ?? [];
      list.push(b);
      byGroup.set(b.groupId, list);
    }
    const out: Section[] = [];
    for (const g of props.groups) {
      const boards = byGroup.get(g.id);
      if (!boards?.length) continue; // hide groups with no boards of this kind
      out.push({ id: g.id, label: g.name, hint: props.spaceName(g.spaceId) ?? g.spaceId, boards });
      byGroup.delete(g.id);
    }
    // Boards whose group wasn't returned (shouldn't happen) still show up.
    for (const [id, boards] of byGroup) out.push({ id, label: "Other", hint: "", boards });
    return out;
  }, [props.boards, props.groups, props.spaceName]);

  if (!props.boards) return <div className="px-2.5 py-1 text-[11px] text-muted-foreground/60">Loading…</div>;
  if (props.boards.length === 0)
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
          <Shapes className="size-5" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium tracking-wide">{props.tab === "doc" ? "No docs yet" : "No diagrams yet"}</p>
          <p className="text-sm leading-relaxed text-ink-muted">
            {props.tab === "doc" ? "Markdown documents with Mermaid diagrams, editable by you and your agents." : "Architecture, AWS/GCP, ERD, flowcharts and process maps — editable by you and your agents."}
          </p>
        </div>
        <button type="button" className="rounded-md border border-outline px-3 py-1 text-[12px] hover:bg-surface-muted" onClick={props.onNew}>
          <span className="inline-flex items-center gap-1">
            <Plus className="size-3.5" /> New {props.tab === "doc" ? "doc" : "diagram"}
          </span>
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      {sections.map((sec) => (
        <div key={sec.id} className="flex flex-col">
          <button
            type="button"
            className="group/title flex min-w-0 items-center gap-1 px-2.5 pb-1 text-left"
            aria-expanded={!props.collapsed[sec.id]}
            onClick={() => props.onToggleSection(sec.id)}
            title={sec.hint ? `${sec.label} · ${sec.hint}` : sec.label}
          >
            <span className="min-w-0 truncate font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 transition-colors group-hover/title:text-muted-foreground">
              {sec.label}
            </span>
            <ChevronRight className={`size-3 shrink-0 text-muted-foreground/40 opacity-0 transition-all group-hover/title:opacity-100 ${props.collapsed[sec.id] ? "" : "rotate-90"}`} strokeWidth={2} />
          </button>
          {props.collapsed[sec.id] ? null : (
            <div className="flex flex-col gap-0.5">
              {sec.boards.map((b) => (
                <BoardRow key={b.id} board={b} active={b.id === props.activeBoardId} onOpen={props.onOpen} onRename={props.onRename} onDelete={props.onDelete} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
