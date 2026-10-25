import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavEmptyStateProps = Omit<ComponentProps<"div">, "title"> & {
  icon?: ReactNode;
  title: string;
  description?: string;
};

export function NavEmptyState({ icon, title, description, className, children, ...props }: NavEmptyStateProps) {
  return (
    <div data-slot="nav-empty-state" className={cn("flex flex-col items-center gap-3 px-4 py-8 text-center", className)} {...props}>
      {icon ? (
        <div className="bg-accent text-muted-foreground flex size-10 items-center justify-center rounded-full [&_svg:not([class*='size-'])]:size-5">{icon}</div>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium tracking-wide">{title}</p>
        {description ? <p className="text-muted-foreground text-sm leading-relaxed">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
