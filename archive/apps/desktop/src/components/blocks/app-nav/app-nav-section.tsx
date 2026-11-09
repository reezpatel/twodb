import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AppNavSectionProps extends Omit<ComponentProps<"div">, "title"> {
  title: string;
  defaultExpanded?: boolean;
  /** Icon buttons shown on the right of the header while hovering it (e.g. "add"). They don't toggle the section. */
  actions?: ReactNode;
}

/** Shell shared by every app-nav section type: a collapsible titled header with optional hover actions, and animated content. */
export function AppNavSection({ title, defaultExpanded = true, actions, className, children, ...props }: AppNavSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = useId();

  return (
    <div data-slot="app-nav-section" className={cn("flex flex-col gap-0.5", className)} {...props}>
      <div className="group/section relative">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((open) => !open)}
          className="group hover:text-foreground focus-visible:ring-ring flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-1"
        >
          <span className="text-muted-foreground group-hover:text-foreground truncate text-[11px] font-semibold tracking-wider uppercase transition-colors duration-150">
            {title}
          </span>
          <ChevronDown
            className={cn("text-muted-foreground group-hover:text-foreground size-3.5 shrink-0 transition-transform duration-200", !expanded && "-rotate-90")}
          />
        </button>
        {actions ? (
          <div className="absolute top-1/2 right-7 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-focus-within/section:opacity-100 group-hover/section:opacity-100 pointer-coarse:opacity-100">
            {actions}
          </div>
        ) : null}
      </div>

      <div
        id={contentId}
        aria-hidden={!expanded}
        inert={!expanded}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
