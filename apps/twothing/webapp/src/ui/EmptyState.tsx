import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed border-outline px-6 py-14 text-center">
      {Icon && (
        <div className="grid size-10 place-items-center rounded-md bg-stone text-ink-muted">
          <Icon className="size-5" strokeWidth={1.5} />
        </div>
      )}
      <div className="text-[15px] font-normal">{title}</div>
      {children && <div className="max-w-sm text-sm font-light text-ink-muted">{children}</div>}
      {action}
    </div>
  );
}
