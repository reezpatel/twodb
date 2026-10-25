import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useAppShellContext } from "./app-shell-context";
import { HamburgerMenuButton } from "./hamburger-menu-button";

type SimpleHeaderProps = ComponentProps<"header"> & {
  title?: string;
};

export function SimpleHeader({ title, className, children, ...props }: SimpleHeaderProps) {
  const { variant, navigationOpen, holdNavigation, releaseNavigation } = useAppShellContext();
  const floating = variant === "floating";

  return (
    <header
      data-slot="app-shell-simple-header"
      className={cn("bg-card h-12 shrink-0 items-center gap-3 border-b px-3", variant === "attached" ? "flex lg:hidden" : "flex", className)}
      onMouseEnter={() => floating && navigationOpen && holdNavigation()}
      onMouseLeave={() => floating && navigationOpen && releaseNavigation()}
      {...props}
    >
      <HamburgerMenuButton />
      {title ? <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span> : null}
      {children}
    </header>
  );
}
