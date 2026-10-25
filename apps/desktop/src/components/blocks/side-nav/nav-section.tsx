import { createContext, useContext, useState, type ComponentProps } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type NavSectionContextValue = {
  collapsible: boolean;
  open: boolean;
  toggle: () => void;
};

const NavSectionContext = createContext<NavSectionContextValue>({ collapsible: false, open: true, toggle: () => {} });

type NavSectionProps = ComponentProps<"div"> & {
  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function NavSection({ collapsible = false, defaultOpen = true, open, onOpenChange, className, ...props }: NavSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const current = open ?? internalOpen;
  const toggle = () => {
    onOpenChange?.(!current);
    setInternalOpen(!current);
  };

  return (
    <NavSectionContext.Provider value={{ collapsible, open: current, toggle }}>
      <div data-slot="nav-section" data-state={current ? "open" : "closed"} className={cn("flex flex-col", className)} {...props} />
    </NavSectionContext.Provider>
  );
}

export function NavSectionHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="nav-section-header"
      className={cn(
        "group/header text-muted-foreground/70 flex items-center justify-between gap-1 px-3 pt-4 pb-1 text-base font-medium tracking-wide lg:pt-3 lg:pb-1 lg:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function NavSectionTitle({ className, children, ...props }: ComponentProps<"button">) {
  const { collapsible, open, toggle } = useContext(NavSectionContext);
  const titleClassName = cn("flex min-w-0 flex-1 items-center gap-1 text-left", className);

  if (!collapsible) {
    return (
      <span data-slot="nav-section-title" className={titleClassName}>
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-slot="nav-section-title"
      aria-expanded={open}
      onClick={toggle}
      className={cn(titleClassName, "focus-visible:ring-ring rounded-sm outline-none focus-visible:ring-2")}
      {...props}
    >
      <ChevronRight className={cn("size-4 shrink-0 lg:size-3 transition-transform", open && "rotate-90")} aria-hidden="true" />
      {children}
    </button>
  );
}

export function NavSectionActions({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="nav-section-actions" className={cn("flex shrink-0 items-center gap-1", className)} {...props} />;
}

export function NavSectionAction({ className, type = "button", ...props }: ComponentProps<"button">) {
  return (
    <button
      type={type}
      data-slot="nav-section-action"
      className={cn(
        "text-muted-foreground/50 hover:bg-accent hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-sm outline-none lg:size-4",
        "transition-opacity focus-visible:opacity-100 data-[state=open]:opacity-100 lg:opacity-0 lg:group-hover/header:opacity-100",
        "[&_svg:not([class*='size-'])]:size-4 lg:[&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      {...props}
    />
  );
}

export function NavSectionInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="nav-section-input"
      className={cn("m-0 h-auto min-w-0 flex-1 border-0 bg-transparent p-0 [font:inherit] [letter-spacing:inherit] outline-none", className)}
      {...props}
    />
  );
}

export function NavSectionContent({ className, ...props }: ComponentProps<"div">) {
  const { open } = useContext(NavSectionContext);
  if (!open) return null;
  return <div data-slot="nav-section-content" className={cn("flex flex-col", className)} {...props} />;
}
