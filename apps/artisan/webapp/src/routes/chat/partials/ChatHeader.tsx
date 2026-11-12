import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../../lib/cn.js";

/** Compact top toolbar (legacy code-header). */
export function ChatHeader({ className, ...props }: ComponentProps<"header">) {
  return <header data-slot="chat-header" className={cn("flex shrink-0 items-center gap-1.5 border-b bg-surface px-3 py-2", className)} {...props} />;
}

/** Session/directory title block. */
export function ChatHeaderTitle({ title, sub, className }: { title: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div data-slot="chat-header-title" className={cn("flex min-w-0 flex-col", className)}>
      <span className="truncate text-[13px] font-medium text-ink">{title}</span>
      {sub ? <span className="truncate font-mono text-[11px] text-ink-muted">{sub}</span> : null}
    </div>
  );
}

type Status = "live" | "connecting" | "offline";

/** Connection dot + label (hidden when live, like legacy). */
export function ChatHeaderStatus({ status, label, className, ...props }: ComponentProps<"span"> & { status: Status; label: string }) {
  if (status === "live") return null;
  const dot = status === "connecting" ? "animate-pulse bg-warning" : "bg-destructive";
  const text = status === "connecting" ? "text-warning" : "text-destructive";
  return (
    <span data-slot="chat-header-status" data-status={status} role="status" title={label} className={cn("flex shrink-0 items-center gap-1.5 px-1", className)} {...props}>
      <span className={cn("inline-block size-2 shrink-0 rounded-full", dot)} aria-hidden="true" />
      <span className={cn("text-xs font-medium", text)}>{label}</span>
    </span>
  );
}

export function ChatHeaderActions({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="chat-header-actions" className={cn("ml-auto flex items-center gap-0.5", className)} {...props} />;
}

/** Ghost icon button with title tooltip (native title, keeps it simple). */
export function ChatHeaderAction({ icon, label, active = false, loading = false, className, type = "button", ...props }: Omit<ComponentProps<"button">, "children"> & {
  icon: ReactNode;
  label: string;
  active?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-busy={loading || undefined}
      data-slot="chat-header-action"
      data-active={active || undefined}
      className={cn(
        "flex size-7 items-center justify-center rounded-md transition-colors",
        active ? "text-success" : "text-ink-muted hover:text-ink",
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : icon}
    </button>
  );
}
