import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CodeChatSessionLinkProps = Omit<ComponentProps<"button">, "title"> & {
  icon: ReactNode;
  title: string;
  meta?: string;
  description?: string;
  trailing?: ReactNode;
};

export function CodeChatSessionLink({ icon, title, meta, description, trailing, className, type = "button", ...props }: CodeChatSessionLinkProps) {
  return (
    <button
      type={type}
      data-slot="code-chat-session-link"
      className={cn(
        "hover:bg-accent/50 focus-visible:ring-ring flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors outline-none focus-visible:ring-2",
        className,
      )}
      {...props}
    >
      <span className="text-primary mt-0.5 shrink-0 [&_svg:not([class*='size-'])]:size-3.5">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="font-medium">{title}</span>
        {meta ? <span className="text-muted-foreground ml-2 font-mono text-[10px]">{meta}</span> : null}
        {description ? <span className="text-muted-foreground mt-0.5 block truncate text-[11px]">{description}</span> : null}
      </span>
      {trailing ? <span className="text-muted-foreground mt-0.5 shrink-0 [&_svg:not([class*='size-'])]:size-3">{trailing}</span> : null}
    </button>
  );
}
