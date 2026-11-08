import type { ComponentProps } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Orb } from "@/components/ui/thinking-orbs";

type CodeChatErrorProps = Omit<ComponentProps<"div">, "title"> & {
  tone?: "failed" | "retrying" | "warning";
  title: string;
  time?: string;
};

export function CodeChatError({ tone = "failed", title, time, className, children, ...props }: CodeChatErrorProps) {
  const retrying = tone === "retrying";
  const warning = tone !== "failed";

  return (
    <div
      data-slot="code-chat-error"
      data-tone={tone}
      role="alert"
      className={cn("flex items-start gap-2 rounded-sm px-3 py-2 text-sm", warning ? "bg-warning/10" : "bg-destructive/10", className)}
      {...props}
    >
      {retrying ? (
        <Orb state="retrying" size={16} className="text-warning shrink-0" />
      ) : (
        <AlertTriangle className={cn("mt-0.5 size-3.5 shrink-0", warning ? "text-warning" : "text-destructive")} aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("font-medium", warning ? "text-warning" : "text-destructive")}>{title}</span>
        {children ? <span className="text-muted-foreground mt-0.5 block text-[13px] break-all whitespace-pre-wrap">{children}</span> : null}
      </span>
      {time ? <span className="text-muted-foreground/70 shrink-0 text-[13px]">{time}</span> : null}
    </div>
  );
}
