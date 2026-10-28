import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "flex h-8 shrink-0 items-center gap-1 rounded-full border px-2 text-xs outline-none transition-colors focus-visible:ring-ring focus-visible:ring-2 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      tone: {
        primary: "data-[active]:border-primary data-[active]:bg-primary/15 data-[active]:text-primary",
        info: "data-[active]:border-info data-[active]:bg-info/15 data-[active]:text-info",
        success: "data-[active]:border-success data-[active]:bg-success/15 data-[active]:text-success",
        warning: "data-[active]:border-warning data-[active]:bg-warning/15 data-[active]:text-warning",
      },
    },
    defaultVariants: { tone: "primary" },
  },
);

type CodeChatComposerToggleProps = Omit<ComponentProps<"button">, "children"> &
  VariantProps<typeof toggleVariants> & {
    icon: ReactNode;
    label: string;
    active?: boolean;
  };

export function CodeChatComposerToggle({ icon, label, active = false, tone, className, type = "button", ...props }: CodeChatComposerToggleProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      aria-label={label}
      title={label}
      data-slot="code-chat-composer-toggle"
      data-active={active || undefined}
      className={cn(toggleVariants({ tone }), "text-muted-foreground hover:text-foreground border-transparent", className)}
      {...props}
    >
      {icon}
      <span
        className={cn(
          "grid overflow-hidden whitespace-nowrap transition-[grid-template-columns,opacity] duration-200",
          active ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0",
        )}
      >
        <span className="min-w-0 overflow-hidden">{label}</span>
      </span>
    </button>
  );
}

export function CodeChatComposerDivider({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="code-chat-composer-divider" aria-hidden="true" className={cn("bg-border mx-1 h-4 w-px", className)} {...props} />;
}
