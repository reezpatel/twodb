import { forwardRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { TicketSummary } from "../use-projects";
import { PriorityIcon, StatusIcon, TypeIcon } from "./board";

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Dense Linear-style list row shared by Backlog and Sprints. */
export const TicketRow = forwardRef<HTMLDivElement, { ticket: TicketSummary; onOpen: () => void; className?: string } & React.HTMLAttributes<HTMLDivElement>>(function TicketRow(
  { ticket, onOpen, className, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      onClick={onOpen}
      className={cn("group/row hover:bg-accent/50 flex h-11 cursor-pointer items-center gap-3 px-4 text-sm transition-colors", className)}
    >
      <span className="flex w-4 shrink-0 justify-center">
        <PriorityIcon priority={ticket.priority} />
      </span>
      <span className="text-muted-foreground w-20 shrink-0 font-mono text-xs">{ticket.identifier}</span>
      {ticket.status && <StatusIcon category={ticket.status.category} color={ticket.status.color} />}
      <TypeIcon type={ticket.type} />
      <span className="min-w-0 flex-1 truncate">{ticket.title}</span>
      <span className="hidden items-center gap-1.5 md:flex">
        {ticket.labels.slice(0, 3).map((l) => (
          <span key={l.id} className="text-muted-foreground inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[11px] whitespace-nowrap">
            <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: l.color }} />
            {l.name}
          </span>
        ))}
        {ticket.labels.length > 3 && <span className="text-muted-foreground text-[11px]">+{ticket.labels.length - 3}</span>}
      </span>
      <span className="text-muted-foreground w-8 shrink-0 text-right font-mono text-xs tabular-nums">{ticket.estimate ?? ""}</span>
      <span className="text-muted-foreground hidden w-14 shrink-0 text-right text-xs lg:block">{shortDate(ticket.updatedAt)}</span>
      <span className="flex w-6 shrink-0 justify-end">
        {ticket.assignee && (
          <Avatar className="size-5">
            {ticket.assignee.image && <AvatarImage src={ticket.assignee.image} />}
            <AvatarFallback className="text-[8px]">{ticket.assignee.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        )}
      </span>
    </div>
  );});
