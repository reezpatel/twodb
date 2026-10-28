import type { ComponentProps, ReactNode } from "react";
import { MonitorCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function CodeChatResources({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="code-chat-resources"
      className={cn("text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px]", className)}
      {...props}
    />
  );
}

export function CodeChatResourcesEmpty({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="code-chat-resources-empty" className={cn("text-muted-foreground/60", className)} {...props} />;
}

type CodeChatResourceRunnerProps = ComponentProps<"span"> & {
  name: string;
};

export function CodeChatResourceRunner({ name, className, children, ...props }: CodeChatResourceRunnerProps) {
  return (
    <span data-slot="code-chat-resource-runner" className={cn("flex items-center gap-3", className)} {...props}>
      <span className="font-semibold">{name}</span>
      {children}
    </span>
  );
}

type CodeChatResourceMetricProps = ComponentProps<"span"> & {
  label: string;
  value: string;
  /** 0–100, or null when there is nothing to chart. */
  percent: number | null;
  warnAt?: number;
  dangerAt?: number;
};

export function CodeChatResourceMetric({ label, value, percent, warnAt = 85, dangerAt = 95, className, ...props }: CodeChatResourceMetricProps) {
  const clamped = percent === null ? null : Math.min(100, Math.max(0, percent));
  const tone = percent === null ? "" : percent >= dangerAt ? "bg-destructive" : percent >= warnAt ? "bg-warning" : "bg-primary/70";

  return (
    <span
      data-slot="code-chat-resource-metric"
      className={cn("flex items-center gap-1.5", className)}
      title={`${label} ${value}${percent !== null ? ` (${Math.round(percent)}%)` : ""}`}
      {...props}
    >
      <span className="truncate">{label}</span>
      <span className="bg-muted-foreground/20 relative h-1 w-10 overflow-hidden rounded-full">
        {clamped !== null ? <span className={cn("absolute inset-y-0 left-0 rounded-full", tone)} style={{ width: `${clamped}%` }} /> : null}
      </span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

type CodeChatResourcesSettingsProps = ComponentProps<typeof Popover> & {
  title?: string;
  triggerLabel?: string;
  children: ReactNode;
};

/** The ⚙ button and popover for choosing which metrics show. Fills the remaining row width to sit at the right edge. */
export function CodeChatResourcesSettings({
  title = "Footer resources",
  triggerLabel = "Choose resources to show",
  children,
  ...props
}: CodeChatResourcesSettingsProps) {
  return (
    <Popover {...props}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={triggerLabel}
          title={triggerLabel}
          data-slot="code-chat-resources-settings"
          className="hover:text-foreground focus-visible:ring-ring data-[state=open]:text-foreground ml-auto rounded-sm transition-colors outline-none focus-visible:ring-2"
        >
          <MonitorCog className="size-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-72 p-3">
        <div className="mb-2 text-xs font-semibold">{title}</div>
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function CodeChatResourcesSettingsEmpty({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="code-chat-resources-settings-empty" className={cn("text-muted-foreground text-xs", className)} {...props} />;
}

type CodeChatResourcesSettingsRunnerProps = ComponentProps<"div"> & {
  name: string;
};

export function CodeChatResourcesSettingsRunner({ name, className, children, ...props }: CodeChatResourcesSettingsRunnerProps) {
  return (
    <div data-slot="code-chat-resources-settings-runner" className={cn("border-t py-2 first:border-t-0", className)} {...props}>
      <div className="mb-1 text-[11px] font-semibold">{name}</div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

type CodeChatResourcesSettingsToggleProps = Omit<ComponentProps<"button">, "children"> & {
  icon: ReactNode;
  label: string;
  on?: boolean;
};

export function CodeChatResourcesSettingsToggle({ icon, label, on = false, className, type = "button", ...props }: CodeChatResourcesSettingsToggleProps) {
  return (
    <button
      type={type}
      aria-pressed={on}
      data-slot="code-chat-resources-settings-toggle"
      data-on={on || undefined}
      className={cn(
        "focus-visible:ring-ring flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors outline-none focus-visible:ring-2 [&_svg:not([class*='size-'])]:size-3",
        on ? "border-primary/40 bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    >
      {icon}
      {label}
    </button>
  );
}
