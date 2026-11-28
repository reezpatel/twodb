import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../../../lib/utils";

export type NavItemData = {
  id: string;
  title: string;
  icon?: React.ElementType;
  badge?: number | string;
  shortcut?: string;
  children?: NavItemData[];
};

export type NavGroupData = {
  heading?: string;
  /** Optional action rendered at the right of the heading (e.g. a "+" to create an item in this group). */
  headingAction?: { icon: React.ElementType; label: string; onClick: () => void };
  items: NavItemData[];
};

export interface NavItemProps {
  item: NavItemData;
  activeId?: string;
  onSelect?: (id: string) => void;
  level?: number;
  /** Open/closed state for items with children, keyed by item id. Uncontrolled if omitted. */
  defaultOpen?: boolean;
}

/** A single nav row; recurses into `item.children` as an indented, collapsible sub-list. */
function NavItem({ item, activeId, onSelect, level = 0, defaultOpen = false }: NavItemProps) {
  const isActive = activeId === item.id;
  const hasChildren = !!item.children?.length;
  const [open, setOpen] = React.useState(defaultOpen);
  const Icon = item.icon;

  return (
    <div data-slot="nav-item" className="flex w-full flex-col">
      <button
        type="button"
        data-active={isActive}
        onClick={() => (hasChildren ? setOpen((o) => !o) : onSelect?.(item.id))}
        className={cn(
          "group flex w-full items-center justify-between gap-2 rounded-[8px] py-[7px] pr-2 text-left outline-none transition-colors",
          isActive ? "bg-stone text-ink" : "text-muted-foreground hover:bg-paper-grid hover:text-ink",
          "focus-visible:outline-2 focus-visible:outline-ion-deep focus-visible:-outline-offset-2",
        )}
        style={{ paddingLeft: `${level * 14 + 10}px` }}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {Icon ? (
            <Icon className={cn("size-4 shrink-0", isActive ? "text-ink" : "text-muted-foreground/80 group-hover:text-ink/80")} strokeWidth={1.5} />
          ) : null}
          <span className={cn("truncate font-sans text-[13px] leading-none", isActive ? "font-light" : "font-light")}>{item.title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {item.shortcut ? (
            <kbd className="hidden h-5 items-center rounded-[4px] border border-outline bg-paper px-1.5 font-mono text-[10px] leading-none text-muted-foreground group-hover:inline-flex">
              {item.shortcut}
            </kbd>
          ) : null}
          {item.badge ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ion/60 px-1.5 text-[10px] font-semibold leading-none text-ink">
              {item.badge}
            </span>
          ) : null}
          {hasChildren ? <ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")} strokeWidth={2} /> : null}
        </span>
      </button>

      {hasChildren ? (
        <div className={cn("grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
          <div className="relative flex min-h-0 flex-col gap-0.5 overflow-hidden pt-0.5">
            {/* Rail connecting nested items to their parent. */}
            <span aria-hidden className="absolute bottom-0 top-0 border-l border-ink/5" style={{ left: `${level * 12 + 17.5}px` }} />
            {item.children!.map((child) => (
              <NavItem key={child.id} item={child} activeId={activeId} onSelect={onSelect} level={level + 1} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export interface NavSectionProps {
  group: NavGroupData;
  activeId?: string;
  onSelect?: (id: string) => void;
}

/** A labeled (or unlabeled) group of nav items. */
function NavSection({ group, activeId, onSelect }: NavSectionProps) {
  const Action = group.headingAction?.icon;
  return (
    <div data-slot="nav-section" className="flex flex-col gap-0.5">
      {group.heading ? (
        <div className="flex items-center justify-between pr-1">
          <span className="px-2.5 pb-1 font-sans text-[11px] font-semibold tracking-wider text-muted-foreground/50 uppercase">{group.heading}</span>
          {Action ? (
            <button
              type="button"
              aria-label={group.headingAction!.label}
              title={group.headingAction!.label}
              onClick={() => group.headingAction!.onClick()}
              className="flex size-5 items-center justify-center rounded-[5px] text-muted-foreground/60 transition-colors hover:bg-paper-grid hover:text-ink"
            >
              <Action className="size-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      ) : null}
      {group.items.map((item) => (
        <NavItem key={item.id} item={item} activeId={activeId} onSelect={onSelect} />
      ))}
    </div>
  );
}

export { NavItem, NavSection };
