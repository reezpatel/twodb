import { Sparkles, X } from "lucide-react";

export function Toast(props: { message: string | null; onDismiss(): void }) {
  if (!props.message) return null;
  return (
    <div role="status" className="absolute bottom-4 left-1/2 z-20 flex max-w-md -translate-x-1/2 items-center gap-2 rounded-full border border-outline bg-ink px-4 py-2 text-[13px] text-paper shadow-xl">
      <Sparkles className="size-4 shrink-0" />
      <span className="truncate">{props.message}</span>
      <button type="button" aria-label="Dismiss" onClick={props.onDismiss} className="rounded-full p-0.5 hover:bg-paper/20">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
