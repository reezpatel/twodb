import { MessageCircle, Plus } from "lucide-react";
import { cn } from "@twodb/blocks";
import type { ConversationList } from "../../../lib/chat-client";

/** Dynamic top-level list tabs. Messages is simply the default list. */
export function ListGroupTabs(props: {
  lists: ConversationList[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="border-b border-border px-2 py-2">
      <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Conversation lists">
        {props.lists.map((list) => (
          <button
            key={list.id}
            type="button"
            role="tab"
            aria-selected={props.activeId === list.id}
            onClick={() => props.onSelect(list.id)}
            className={cn(
              "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-colors",
              props.activeId === list.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {list.isDefault ? <MessageCircle size={13} /> : <span className="grid size-3.5 place-items-center rounded bg-primary/15 text-[9px] text-primary">{list.name[0]?.toUpperCase()}</span>}
            <span className="max-w-24 truncate">{list.name}</span>
            {list.unreadCount > 0 ? <span className={cn("rounded-full px-1 text-[9px]", props.activeId === list.id ? "bg-background/20" : "bg-primary text-primary-foreground")}>{list.unreadCount > 9 ? "9+" : list.unreadCount}</span> : null}
          </button>
        ))}
        <button type="button" aria-label="Add conversation list" onClick={props.onAdd} className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Plus size={13} /></button>
      </div>
    </div>
  );
}
