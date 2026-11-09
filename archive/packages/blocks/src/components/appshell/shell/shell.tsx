import * as React from "react";
import { cn } from "../../../lib/utils";

/**
 * Root shell container — a full-height column. Put `AppShellBody` as its direct child
 * (plus an optional `StatusBar` after it, spanning the full width at the very bottom).
 */
function AppShell({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="app-shell" className={cn("flex h-full min-h-0 w-full flex-col overflow-hidden bg-paper text-ink", className)} {...props} />;
}

/**
 * The main row: side navigation (IconRail / NavSidebar / Sidebar) sits here alongside
 * `AppShellMain`, so nav panels stretch the full available height — there is no global
 * header above this row pushing them down.
 */
function AppShellBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="app-shell-body" className={cn("relative flex min-h-0 flex-1", className)} {...props} />;
}

/** The main content column: its own header (if any) + scrollable content, scoped to this pane only. */
function AppShellMain({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="app-shell-main" className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-paper", className)} {...props} />;
}

/** A slim header local to `AppShellMain` — does not span above the side nav. */
function AppShellHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="app-shell-header"
      className={cn("flex h-10 shrink-0 items-center gap-2 bg-paper px-4 font-sans text-[15px] font-bold text-ink", className)}
      {...props}
    />
  );
}

/** Scrollable content region inside `AppShellMain`. */
function AppShellContent({ className, ...props }: React.ComponentProps<"main">) {
  return <main data-slot="app-shell-content" className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-paper", className)} {...props} />;
}

export { AppShell, AppShellBody, AppShellMain, AppShellHeader, AppShellContent };
