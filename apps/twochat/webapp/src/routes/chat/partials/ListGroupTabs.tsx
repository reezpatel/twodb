import { MessageCircle, Plus } from "lucide-react";
import { cn } from "@twodb/blocks";
import type { ConversationList } from "../../../lib/chat-client";

/** Dynamic top-level list tabs, styled as artisan's segmented icon tabs. Messages is simply the default list. */
export function ListGroupTabs(props: {
  lists: ConversationList[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="mb-2 flex shrink-0 gap-1 rounded-[8px] bg-paper-grid/60 p-0.5" role="tablist" aria-label="Conversation lists">
      {props.lists.map((list) => (
        <button
          key={list.id}
          type="button"
          role="tab"
          aria-selected={props.activeId === list.id}
          aria-label={list.name}
          title={list.name}
          onClick={() => props.onSelect(list.id)}
          className={cn(
            "relative flex h-7 flex-1 min-w-0 items-center justify-center rounded-[6px] transition-colors",
            props.activeId === list.id ? "bg-stone text-ink" : "text-muted-foreground hover:text-ink",
          )}
        >
          {list.isDefault ? <MessageCircle className="size-4 shrink-0" strokeWidth={1.5} /> : <span className="grid size-4 shrink-0 place-items-center rounded font-sans text-[9px] font-semibold">{list.name[0]?.toUpperCase()}</span>}
          {list.unreadCount > 0 ? (
            <span
              aria-label={`${list.unreadCount} unread messages`}
              className={cn(
                "absolute right-1 top-1 grid min-w-3.5 place-items-center rounded-full px-1 text-[9px] font-semibold leading-none tabular-nums text-primary-foreground",
                props.activeId === list.id ? "bg-ink/60" : "bg-primary",
              )}
            >
              {list.unreadCount > 9 ? "9+" : list.unreadCount}
            </span>
          ) : null}
        </button>
      ))}
      <button
        type="button"
        aria-label="Add conversation list"
        title="Add conversation list"
        onClick={props.onAdd}
        className="flex h-7 shrink-0 items-center justify-center rounded-[6px] px-2 text-muted-foreground transition-colors hover:text-ink"
      >
        <Plus className="size-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}
