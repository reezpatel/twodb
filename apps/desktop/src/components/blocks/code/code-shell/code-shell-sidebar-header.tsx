import type { ComponentProps } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type CodeShellSidebarHeaderProps = Omit<ComponentProps<"header">, "title"> & {
  title?: string;
  onClose?: () => void;
  closeLabel?: string;
  mobileOnly?: boolean;
};

export function CodeShellSidebarHeader({
  title,
  onClose,
  closeLabel = "Close",
  mobileOnly = false,
  className,
  children,
  ...props
}: CodeShellSidebarHeaderProps) {
  return (
    <header
      data-slot="code-shell-sidebar-header"
      className={cn("flex shrink-0 items-center gap-2 border-b px-3 py-2", mobileOnly && "xl:hidden", className)}
      {...props}
    >
      {title ? <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span> : null}
      {children}
      {onClose ? (
        <button
          type="button"
          aria-label={closeLabel}
          title={closeLabel}
          onClick={onClose}
          className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring ml-auto flex size-6 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </header>
  );
}
