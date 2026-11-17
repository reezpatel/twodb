import { cn } from "../lib/cn.js";

/** Shared dialog overlay + form atoms (one place, used by all dialogs/pages). */
export function Overlay({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={cn("max-h-[92dvh] w-full overflow-y-auto rounded-t-xl border border-outline/60 bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:max-h-[85dvh] sm:rounded-xl sm:p-5", wide ? "max-w-2xl" : "max-w-lg")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-ink-muted hover:bg-surface-muted hover:text-ink" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const btnPrimary = "flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50";
export const btnGhost = "rounded-md border border-outline/60 px-3 py-1.5 text-[12px] text-ink-muted transition-colors hover:border-outline-strong hover:text-ink";
export const inputCls = "h-9 w-full rounded-md bg-surface-muted px-2.5 text-[13px] outline-none focus:ring-1 focus:ring-outline-strong";
export const labelCls = "text-[12px] font-medium text-ink-muted";
