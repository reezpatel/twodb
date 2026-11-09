import type { ComponentProps, ReactNode } from "react";
import { AnimatePresence, Reorder, useDragControls, useReducedMotion } from "framer-motion";
import { ArrowUpToLine, Copy, Forward, GripVertical, ListEnd, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface QueuedMessage {
  id: string;
  content: string;
  attachments?: number;
  status?: "queued" | "sending";
}

export interface CodeChatQueueProps extends Omit<ComponentProps<"section">, "onReorder"> {
  items: QueuedMessage[];
  onRemove?: (id: string) => void;
  /** Sends the queue now (stops the run and dispatches). */
  onSendNow?: (id: string) => void;
  onMoveToTop?: (id: string) => void;
  onReorder?: (items: QueuedMessage[]) => void;
}

function QueueRow({ item, enabled, onMove, children }: { item: QueuedMessage; enabled: boolean; onMove: (direction: number) => void; children: ReactNode }) {
  const controls = useDragControls();
  const reducedMotion = useReducedMotion();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="group/queue-row bg-card relative flex items-center gap-2 rounded-md py-1"
      whileDrag={{ zIndex: 10 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        default: reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 },
        opacity: { duration: 0.15, ease: [0.23, 1, 0.32, 1] },
      }}
    >
      <button
        type="button"
        disabled={!enabled}
        aria-label={`Reorder message: ${item.content}`}
        title="Drag to reorder, or use Up and Down arrow keys"
        className="text-muted-foreground focus-visible:ring-ring relative flex h-7 w-4 shrink-0 touch-none items-center justify-center rounded-sm outline-none focus-visible:ring-2 active:cursor-grabbing enabled:cursor-grab"
        onPointerDown={(event) => {
          if (enabled) controls.start(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            onMove(event.key === "ArrowUp" ? -1 : 1);
          }
        }}
      >
        <ListEnd
          aria-hidden="true"
          className={cn(
            "absolute size-4 opacity-100 transition-opacity duration-150 ease-out",
            enabled && "group-focus-within/queue-row:opacity-0 group-hover/queue-row:opacity-0",
          )}
        />
        <GripVertical
          aria-hidden="true"
          className={cn(
            "absolute size-4 opacity-0 transition-opacity duration-150 ease-out",
            enabled && "group-focus-within/queue-row:opacity-100 group-hover/queue-row:opacity-100",
          )}
        />
      </button>
      {children}
    </Reorder.Item>
  );
}

/** Reorderable list of messages queued while a round is running. */
export function CodeChatQueue({ className, items, onRemove, onSendNow, onMoveToTop, onReorder, ...props }: CodeChatQueueProps) {
  return (
    <section
      aria-label="Queued messages"
      data-slot="code-chat-queue"
      className={cn("bg-card text-muted-foreground rounded-sm border border-dashed px-4 py-2 text-sm", className)}
      {...props}
    >
      <Reorder.Group as="ol" axis="y" values={items} onReorder={(next) => onReorder?.(next)}>
        <AnimatePresence initial={false}>
          {items.map((item, index) => (
            <QueueRow
              key={item.id}
              item={item}
              enabled={!!onReorder}
              onMove={(direction) => {
                const target = index + direction;
                if (target < 0 || target >= items.length) return;
                const next = [...items];
                [next[index], next[target]] = [next[target], next[index]];
                onReorder?.(next);
              }}
            >
              <p className="text-muted-foreground line-clamp-2 min-w-0 flex-1 font-mono text-xs leading-5 break-words">{item.content}</p>
              {item.attachments ? <span className="text-muted-foreground shrink-0 text-xs">{item.attachments} files</span> : null}
              <div className="flex shrink-0 items-center gap-0.5">
                {onSendNow && (
                  <Button
                    type="button"
                    disabled={item.status === "sending"}
                    onClick={() => onSendNow(item.id)}
                    size="sm"
                    variant="ghost"
                    title="Stops the run and dispatches the queue"
                    className="text-muted-foreground gap-1.5"
                  >
                    <Forward className="size-4" />
                    {item.status === "sending" ? "Steering…" : "Steer"}
                  </Button>
                )}
                {onRemove && (
                  <Button
                    type="button"
                    aria-label={`Remove queued message: ${item.content}`}
                    onClick={() => onRemove(item.id)}
                    size="icon-sm"
                    variant="ghost"
                    className="hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" aria-label={`More actions for: ${item.content}`} size="icon-sm" variant="ghost">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-36">
                    <DropdownMenuItem onSelect={() => void navigator.clipboard.writeText(item.content)}>
                      <Copy /> Copy message
                    </DropdownMenuItem>
                    {onMoveToTop && (
                      <DropdownMenuItem disabled={index === 0} onSelect={() => onMoveToTop(item.id)}>
                        <ArrowUpToLine /> Move to top
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </QueueRow>
          ))}
        </AnimatePresence>
      </Reorder.Group>
    </section>
  );
}
