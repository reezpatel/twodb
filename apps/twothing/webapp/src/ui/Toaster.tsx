import { cn } from "@twodb/blocks";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { dismiss, useToasts } from "../lib/toast";

export function Toaster() {
  const toasts = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[80] flex flex-col items-center gap-2 px-3 md:bottom-6">
      {toasts.map((t) => {
        const Icon = t.tone === "success" ? CircleCheck : t.tone === "error" ? CircleAlert : Info;
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-md animate-in items-center gap-3 rounded-2xl border border-white/10 bg-[#1d1c1a] px-4 py-3 text-sm text-white shadow-2xl fade-in-0 slide-in-from-bottom-4"
          >
            <Icon className={cn("size-4 shrink-0", t.tone === "success" ? "text-emerald-400" : t.tone === "error" ? "text-rose-400" : "text-sky-300")} />
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action && (
              <button
                className="rounded-full px-2 py-1 font-semibold text-amber-300 hover:bg-white/10"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button aria-label="Dismiss" className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white" onClick={() => dismiss(t.id)}>
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
