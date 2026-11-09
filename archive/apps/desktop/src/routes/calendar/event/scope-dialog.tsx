import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { RecurrenceScope } from "../calendar-api";
import type { ScopeRequest } from "../use-calendar-scene";

const OPTIONS: { id: RecurrenceScope; label: string }[] = [
  { id: "this", label: "This event" },
  { id: "following", label: "This and following events" },
  { id: "all", label: "All events" },
];

export function ScopeDialog({ request, onClose }: { request: ScopeRequest | null; onClose: () => void }) {
  const [scope, setScope] = useState<RecurrenceScope>("this");
  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{request?.title} recurring event</DialogTitle>
          <DialogDescription>Which events should change?</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5" role="radiogroup">
          {OPTIONS.filter((o) => o.id !== "following" || request?.allowFollowing).map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={scope === o.id}
              onClick={() => setScope(o.id)}
              className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm", scope === o.id && "border-primary bg-primary/5")}
            >
              <span className={cn("size-3.5 rounded-full border", scope === o.id && "border-primary border-4")} />
              {o.label}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              request?.run(scope);
              onClose();
            }}
          >
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
