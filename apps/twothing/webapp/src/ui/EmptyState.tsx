import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-outline px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-stone text-ink-muted">
        <Icon className="size-7" />
      </div>
      <div className="text-lg font-semibold">{title}</div>
      {children && <div className="max-w-sm text-sm text-ink-muted">{children}</div>}
      {action}
    </div>
  );
}
