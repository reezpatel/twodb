import * as React from "react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";
import { ChevronRight } from "lucide-react";
import { cn } from "../../../lib/utils";

/** Radix Collapsible, re-themed with B+W tokens. */
function Collapsible(props: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({ className, children, ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-start font-sans text-[12px] font-semibold tracking-wide uppercase transition-colors outline-none hover:bg-stone focus-visible:outline-2 focus-visible:outline-ion-deep focus-visible:-outline-offset-2",
        className,
      )}
      {...props}
    >
      {children}
    </CollapsiblePrimitive.Trigger>
  );
}

function CollapsibleContent({ className, ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return <CollapsiblePrimitive.Content data-slot="collapsible-content" className={cn("outline-none", className)} {...props} />;
}

/** Chevron that rotates open — pass as CollapsibleTrigger's last child. */
function CollapsibleChevron({ open, className }: { open?: boolean; className?: string }) {
  return (
    <ChevronRight
      aria-hidden="true"
      className={cn("ml-auto size-3.5 shrink-0 text-ink-muted transition-transform", open && "rotate-90", className)}
      strokeWidth={2}
    />
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent, CollapsibleChevron };
