import type { ComponentProps, ReactNode } from "react";
import { ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type CodeSidebarSectionProps = Omit<ComponentProps<typeof Collapsible>, "title"> & {
  title: ReactNode;
  /** Shown after the title in muted text, e.g. "2/5". */
  count?: ReactNode;
};

export function CodeSidebarSection({ title, count, className, children, ...props }: CodeSidebarSectionProps) {
  return (
    <Collapsible data-slot="code-sidebar-section" className={cn("group/section border-b last:border-b-0", className)} {...props}>
      <CollapsibleTrigger className="hover:bg-accent/50 focus-visible:ring-ring flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset">
        {title}
        {count ? <span className="text-muted-foreground font-normal">({count})</span> : null}
        <ChevronUp size={16} className="text-muted-foreground ml-auto transition-transform group-data-[state=closed]/section:rotate-180" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}
