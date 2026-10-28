import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ModelBrowserProviders({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      data-slot="model-browser-providers"
      aria-label="Providers"
      className={cn(
        "flex shrink-0 gap-0.5 overflow-x-auto border-b p-2 sm:w-56 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:border-r sm:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

export function ModelBrowserProvidersLabel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="model-browser-providers-label"
      className={cn("text-muted-foreground/70 hidden px-2 pt-3 pb-1 text-[10px] font-semibold tracking-wide uppercase sm:block", className)}
      {...props}
    />
  );
}

type ModelBrowserProviderProps = Omit<ComponentProps<"button">, "children"> & {
  label: string;
  count?: number;
  icon?: ReactNode;
  active?: boolean;
};

export function ModelBrowserProvider({ label, count, icon, active = false, className, type = "button", ...props }: ModelBrowserProviderProps) {
  return (
    <button
      type={type}
      aria-current={active ? "true" : undefined}
      data-slot="model-browser-provider"
      data-active={active || undefined}
      className={cn(
        "focus-visible:ring-ring flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-2",
        active ? "bg-accent text-foreground font-regular" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        className,
      )}
      {...props}
    >
      {icon ? <span className="shrink-0 [&_svg:not([class*='size-'])]:size-4">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined ? <span className="text-muted-foreground/70 text-xs tabular-nums">{count.toLocaleString()}</span> : null}
    </button>
  );
}
