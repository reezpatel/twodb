import { useId, useState, type ComponentProps, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppNav, type AppNavIcon } from "./app-nav-context";
import { AppNavList } from "./app-nav-list";

export interface AppNavLinkFolderProps extends Omit<ComponentProps<"div">, "id"> {
  id: string;
  label: string;
  icon?: AppNavIcon;
  badge?: string;
  defaultExpanded?: boolean;
  disabled?: boolean;
}

/** A link that expands to reveal nested links, with their own branch lines. */
export function AppNavLinkFolder({
  id,
  label,
  icon: CustomIcon,
  badge,
  defaultExpanded = false,
  disabled,
  className,
  children,
  ...props
}: AppNavLinkFolderProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { hoveredId, onHover } = useAppNav();
  const contentId = useId();
  const Icon = CustomIcon ?? (expanded ? FolderOpen : Folder);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight" && !expanded) {
      event.preventDefault();
      setExpanded(true);
    } else if (event.key === "ArrowLeft" && expanded) {
      event.preventDefault();
      setExpanded(false);
    }
  };

  return (
    <div data-slot="app-nav-link-folder" className={cn("flex flex-col gap-0.5", className)} {...props}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        disabled={disabled}
        onClick={() => setExpanded((open) => !open)}
        onMouseEnter={() => !disabled && onHover(id)}
        onKeyDown={onKeyDown}
        className="group text-muted-foreground focus-visible:ring-ring relative flex h-8 cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 pl-8 text-left text-sm font-normal outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40"
      >
        {hoveredId === id ? (
          <motion.span
            layoutId="app-nav-hover"
            className="bg-accent/60 pointer-events-none absolute inset-0 z-0 rounded-md"
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        ) : null}
        <span className="relative z-10 flex min-w-0 items-center gap-2">
          <Icon className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors duration-150" />
          <span className="group-hover:text-foreground truncate leading-none transition-colors duration-150">{label}</span>
        </span>
        <span className="relative z-10 flex items-center gap-1">
          {badge ? (
            <span className="bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-tight uppercase">{badge}</span>
          ) : null}
          <ChevronRight
            className={cn("text-muted-foreground group-hover:text-foreground size-3.5 shrink-0 transition-transform duration-200", expanded && "rotate-90")}
          />
        </span>
      </button>

      <div
        id={contentId}
        aria-hidden={!expanded}
        inert={!expanded}
        className={cn(
          "grid pl-4 transition-[grid-template-rows,opacity] duration-300 ease-in-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <AppNavList>{children}</AppNavList>
        </div>
      </div>
    </div>
  );
}
