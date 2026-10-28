import type { ComponentProps } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type CodeChatErrorProps = Omit<ComponentProps<"div">, "title"> & {
  tone?: "failed" | "retrying";
  title: string;
  time?: string;
};

export function CodeChatError({ tone = "failed", title, time, className, children, ...props }: CodeChatErrorProps) {
  const retrying = tone === "retrying";

  return (
    <div
      data-slot="code-chat-error"
      data-tone={tone}
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
        retrying ? "border-warning/40 bg-warning/5" : "border-destructive/40 bg-destructive/5",
        className,
      )}
      {...props}
    >
      <AlertTriangle className={cn("mt-0.5 size-3.5 shrink-0", retrying ? "text-warning" : "text-destructive")} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={cn("font-medium", retrying ? "text-warning" : "text-destructive")}>{title}</span>
        {children ? <span className="text-muted-foreground mt-0.5 block font-mono text-[11px] break-all whitespace-pre-wrap">{children}</span> : null}
      </span>
      {time ? <span className="text-muted-foreground/70 shrink-0 text-[10px]">{time}</span> : null}
    </div>
  );
}
