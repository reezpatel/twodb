import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, hatched = false, children, ...props }: React.ComponentProps<"div"> & { hatched?: boolean }) {
  return (
    <div data-slot="card" className={cn("overflow-hidden rounded-[10px] border border-outline bg-card", className)} {...props}>
      {hatched ? (
        <div
          aria-hidden
          className="h-6 border-b border-outline"
          style={{
            background: "repeating-linear-gradient(135deg, var(--stone-hatch) 0 1px, transparent 1px 7px)",
          }}
        />
      ) : null}
      {children}
    </div>
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-1 p-4 pb-0", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("font-sans text-[17px] font-bold leading-6 text-ink", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("font-sans text-[15px] leading-[22px] text-ink-muted", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-4 font-sans text-[15px] leading-[22px] text-ink-muted", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center gap-2 p-4 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
