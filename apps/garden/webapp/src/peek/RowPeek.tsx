import { Maximize2, X, Loader2 } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useRecord } from "../lib/queries";
import { usePeek } from "../lib/usePeek";
import { DocEditor } from "../doc/DocEditor";
import { IconButton } from "../ui/IconButton";
import { DatabasePage } from "../database/DatabasePage";

/** AFFiNE peek view: a centered modal showing a row/page without leaving the current page. */
export function RowPeek() {
  const { peekId, closePeek, openFull } = usePeek();
  const { data, isLoading } = useRecord(peekId);
  return (
    <D.Root open={!!peekId} onOpenChange={(o) => !o && closePeek()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-ink/25 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <D.Content
          aria-describedby={undefined}
          className="garden-float fixed left-1/2 top-[4vh] z-40 flex h-[92vh] w-[min(1000px,94vw)] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-outline bg-paper outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          <D.Title className="sr-only">{data?.title || "Page"}</D.Title>
          <div className="flex h-11 shrink-0 items-center justify-end gap-1 border-b border-outline/70 px-3">
            <IconButton title="Open as full page" onClick={() => peekId && openFull(peekId)}>
              <Maximize2 size={15} />
            </IconButton>
            <IconButton title="Close" onClick={closePeek}>
              <X size={16} />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading || !data ? (
              <div className="flex h-40 items-center justify-center text-ink-muted">
                <Loader2 size={16} className="animate-spin" />
              </div>
            ) : data.kind === "database" ? (
              <DatabasePage record={data} />
            ) : (
              <DocEditor key={data.id} record={data} mode="peek" />
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
