import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@twodb/blocks";

/** Small square ghost button used across toolbars, sidebars and headers. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; size?: "sm" | "md" }>(function IconButton(
  { className, active, size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "size-6" : "size-7",
        active && "bg-ink/[0.07] text-ink",
        className,
      )}
      {...props}
    />
  );
});
