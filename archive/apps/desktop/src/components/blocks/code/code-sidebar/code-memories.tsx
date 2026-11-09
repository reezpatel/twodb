import { useState, type ComponentProps } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Which section a memory sits in: shared by the whole organization, by this project, or the agent's own. */
export type CodeMemoryGroup = "global" | "project" | "local";

const GROUPS: { id: CodeMemoryGroup; label: string }[] = [
  { id: "global", label: "Global memories" },
  { id: "project", label: "Project memories" },
  { id: "local", label: "Local memories" },
];

export interface CodeMemory {
  id: string;
  /** Shown on the chip. */
  title: string;
  /** Shown in the dialog when the chip is clicked. */
  content: string;
  group: CodeMemoryGroup;
}

export interface CodeMemoriesProps extends ComponentProps<"div"> {
  memories: CodeMemory[];
  /** Adds a "Forget" button to the dialog. */
  onRemove?: (id: string) => void;
  emptyLabel?: string;
}

/** Memories as title chips, one labelled section per group (empty groups are hidden). Clicking a chip opens its content in a dialog. */
export function CodeMemories({
  memories,
  onRemove,
  emptyLabel = "Nothing saved yet — agents save memories as they learn.",
  className,
  ...props
}: CodeMemoriesProps) {
  const reduced = useReducedMotion();
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = memories.find((m) => m.id === openId);

  if (memories.length === 0) {
    return <p className="text-muted-foreground py-1 text-xs">{emptyLabel}</p>;
  }

  return (
    <>
      <div data-slot="code-memories" className={cn("flex flex-col gap-3", className)} {...props}>
        {GROUPS.map((group) => {
          const items = memories.filter((m) => m.group === group.id);
          if (items.length === 0) return null;
          return (
            <section key={group.id} data-group={group.id} aria-label={group.label} className="flex flex-col gap-1.5">
              <h4 className="text-muted-foreground text-xs font-medium">{group.label}</h4>
              <ul className="flex flex-wrap gap-1.5">
                <AnimatePresence initial={false}>
                  {items.map((memory, index) => (
                    <motion.li
                      key={memory.id}
                      layout={!reduced}
                      initial={reduced ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1], delay: reduced ? 0 : Math.min(index, 5) * 0.04 }}
                      className="max-w-full"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenId(memory.id)}
                        title={memory.title}
                        className="bg-card text-foreground hover:bg-accent focus-visible:ring-ring max-w-full truncate rounded-full border px-2.5 py-1 text-left text-xs outline-none transition-[background-color,transform] duration-150 focus-visible:ring-2 active:scale-[0.97]"
                      >
                        {memory.title}
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>{GROUPS.find((g) => g.id === selected.group)?.label.replace(" memories", " memory")}</DialogDescription>
              </DialogHeader>
              <div className="min-h-0 overflow-y-auto text-sm break-words whitespace-pre-wrap">{selected.content}</div>
              {onRemove ? (
                <DialogFooter>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hover:text-destructive"
                    onClick={() => {
                      onRemove(selected.id);
                      setOpenId(null);
                    }}
                  >
                    Forget
                  </Button>
                </DialogFooter>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
