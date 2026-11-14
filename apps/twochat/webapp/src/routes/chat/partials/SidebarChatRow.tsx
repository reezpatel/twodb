import { cn } from "@twodb/blocks";
import type { ReactNode } from "react";

/** One searchable group/DM result in the chat sidebar. */
export function SidebarChatRow(props: {
  active: boolean;
  avatar: ReactNode;
  label: string;
  preview: string;
  unread: number;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        aria-current={props.active ? "page" : undefined}
        aria-label={`Open chat: ${props.label}`}
        className={cn(
          "group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          props.active ? "bg-primary/10" : "hover:bg-muted/70",
        )}
        onClick={props.onClick}
        type="button"
      >
        {props.avatar}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn("truncate text-sm", props.active || props.unread > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/90")}>
            {props.label}
          </span>
          <span className={cn("truncate text-xs", props.unread > 0 ? "font-medium text-foreground/70" : "text-muted-foreground")}>
            {props.preview}
          </span>
        </span>
        {props.unread > 0 ? (
          <span
            aria-label={`${props.unread} unread messages`}
            className="ml-auto grid min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary-foreground"
          >
            {props.unread > 99 ? "99+" : props.unread}
          </span>
        ) : null}
      </button>
    </li>
  );
}
