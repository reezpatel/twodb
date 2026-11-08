import * as React from "react";
import { AnimatePresence, Reorder, useDragControls, useReducedMotion } from "framer-motion";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { ArrowUpToLine, CornerUpRight, GripVertical, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button/button";

export interface QueuedMessage {
  id: string;
  content: string;
  attachments?: number;
  status?: "queued" | "sending";
}

export interface MessageQueueProps extends React.ComponentProps<"section"> {
  items: QueuedMessage[];
  onRemove?: (id: string) => void;
  onSendNow?: (id: string) => void;
  onMoveToTop?: (id: string) => void;
  onReorder?: (items: QueuedMessage[]) => void;
}

function QueueRow({ item, enabled, onMove, children }: { item: QueuedMessage; enabled: boolean; onMove: (direction: number) => void; children: React.ReactNode }) {
  const controls = useDragControls();
  const reducedMotion = useReducedMotion();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="group/queue-row relative flex items-center gap-2 rounded-[6px] bg-paper py-1.5"
      whileDrag={{ zIndex: 10 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ default: reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }, opacity: { duration: 0.15, ease: [0.23, 1, 0.32, 1] } }}
    >
      <button
        type="button"
        disabled={!enabled}
        aria-label={`Reorder message: ${item.content}`}
        title="Drag to reorder, or use Up and Down arrow keys"
        className="relative flex h-7 w-4 shrink-0 touch-none items-center justify-center rounded-[4px] text-muted-foreground outline-none focus-visible:outline-2 focus-visible:outline-ion-deep active:cursor-grabbing enabled:cursor-grab"
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
        <GripVertical className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
      </button>
      {children}
    </Reorder.Item>
  );
}

function MessageQueue({ className, items, onRemove, onSendNow, onMoveToTop, onReorder, ...props }: MessageQueueProps) {
  return (
    <section
      aria-label="Queued messages"
      data-slot="message-queue"
      className={cn("rounded-[12px] border border-outline bg-stone p-2 font-sans text-[13px] text-muted-foreground", className)}
      {...props}
    >
      <Reorder.Group as="ol" axis="y" values={items} onReorder={(next: QueuedMessage[]) => onReorder?.(next)} className="flex flex-col gap-0.5">
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
              <p className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-5 text-ink/85">{item.content}</p>
              {item.attachments ? <span className="shrink-0 text-[11px] leading-5 text-muted-foreground">{item.attachments} files</span> : null}
              <div className="flex shrink-0 items-center gap-0.5">
                <Button type="button" disabled={item.status === "sending"} onClick={() => onSendNow?.(item.id)} size="sm" variant="ghost" className="gap-1 px-2 text-[12px] text-muted-foreground hover:text-ink">
                  <CornerUpRight className="size-3.5" strokeWidth={1.5} />
                  {item.status === "sending" ? "Steering…" : "Steer"}
                </Button>
                <Button type="button" aria-label={`Remove queued message: ${item.content}`} onClick={() => onRemove?.(item.id)} size="sm" variant="ghost" className="px-1.5 text-muted-foreground hover:text-ink">
                  <Trash2 className="size-3.5" strokeWidth={1.5} />
                </Button>
                <DropdownMenuPrimitive.Root>
                  <DropdownMenuPrimitive.Trigger asChild>
                    <Button type="button" aria-label={`More actions for: ${item.content}`} size="sm" variant="ghost" className="px-1.5 text-muted-foreground hover:text-ink">
                      <MoreHorizontal className="size-3.5" strokeWidth={1.5} />
                    </Button>
                  </DropdownMenuPrimitive.Trigger>
                  <DropdownMenuPrimitive.Portal>
                    <DropdownMenuPrimitive.Content
                      align="end"
                      sideOffset={6}
                      className={cn(
                        "z-50 min-w-[160px] overflow-hidden rounded-[10px] border border-outline bg-popover p-1",
                        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                      )}
                    >
                      <DropdownMenuPrimitive.Item
                        onSelect={() => navigator.clipboard.writeText(item.content)}
                        className="cursor-pointer rounded-[6px] px-2.5 py-1.5 font-sans text-[13px] text-muted-foreground outline-none transition-colors hover:bg-paper-grid hover:text-ink"
                      >
                        Copy message
                      </DropdownMenuPrimitive.Item>
                      {onMoveToTop ? (
                        <DropdownMenuPrimitive.Item
                          disabled={index === 0}
                          onSelect={() => onMoveToTop(item.id)}
                          className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-1.5 font-sans text-[13px] text-muted-foreground outline-none transition-colors hover:bg-paper-grid hover:text-ink data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
                        >
                          <ArrowUpToLine className="size-3.5" strokeWidth={1.5} />
                          Move to top
                        </DropdownMenuPrimitive.Item>
                      ) : null}
                    </DropdownMenuPrimitive.Content>
                  </DropdownMenuPrimitive.Portal>
                </DropdownMenuPrimitive.Root>
              </div>
            </QueueRow>
          ))}
        </AnimatePresence>
      </Reorder.Group>
      {!items.length ? <p className="px-2 py-3 text-[12px] leading-5 text-muted-foreground">No queued messages.</p> : null}
    </section>
  );
}

export { MessageQueue };
