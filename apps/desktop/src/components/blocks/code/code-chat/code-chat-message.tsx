import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type CodeChatMessageProps = ComponentProps<"div"> & {
  variant?: "user" | "assistant";
  label?: string;
};

export function CodeChatMessage({ variant = "assistant", label, className, children, ...props }: CodeChatMessageProps) {
  const user = variant === "user";

  return (
    <div data-slot="code-chat-message" data-variant={variant} className={cn("flex flex-col", user ? "mt-10" : "gap-0.5", className)} {...props}>
      <div className={cn(user && "bg-primary/15 rounded-sm px-3 py-2")}>
        <span className={cn("block text-[11px] font-semibold tracking-wide uppercase", user ? "text-primary" : "text-muted-foreground")}>
          {label ?? (user ? "You" : "Agent")}
        </span>
        {children}
      </div>
    </div>
  );
}

export function CodeChatSkills({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-skills" className={cn("flex flex-wrap justify-end gap-1.5 pb-1", className)} {...props} />;
}

export function CodeChatSkill({ className, children, type = "button", ...props }: ComponentProps<"button">) {
  return (
    <button
      type={type}
      data-slot="code-chat-skill"
      className={cn(
        "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 focus-visible:ring-ring rounded-md border px-1.5 py-[0.1rem] font-medium transition-colors outline-none focus-visible:ring-2",
        className,
      )}
      {...props}
    >
      /{children}
    </button>
  );
}
