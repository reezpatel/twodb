import type { ComponentProps } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppShellContext } from "./app-shell-context";

export function HamburgerMenuButton({ className, onClick, onMouseEnter, children, ...props }: ComponentProps<"button">) {
  const { variant, navigationOpen, openNavigation } = useAppShellContext();

  return (
    <button
      type="button"
      data-slot="app-shell-navigation-trigger"
      aria-label="Open navigation"
      aria-expanded={navigationOpen}
      className={cn(
        "text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring flex size-8 shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2",
        className,
      )}
      onClick={(event) => {
        openNavigation();
        onClick?.(event);
      }}
      onMouseEnter={(event) => {
        if (variant === "floating") openNavigation();
        onMouseEnter?.(event);
      }}
      {...props}
    >
      {children ?? <Menu className="size-5" />}
    </button>
  );
}
