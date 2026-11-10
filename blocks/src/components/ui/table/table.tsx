import * as React from "react";
import { cn } from "../../../lib/utils";

/**
 * Table primitives styled with the Isometric-Lab B+W tokens. Ported from a
 * shadcn-style table component, re-themed: hairline `outline` borders, ink
 * header text, stone hover wash, no color-mix tricks.
 */

export function Table({ className, ...props }: React.ComponentProps<"table">): React.ReactElement {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<"thead">): React.ReactElement {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b [&_tr]:border-outline", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">): React.ReactElement {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0 [&_tr]:border-b [&_tr]:border-outline", className)}
      {...props}
    />
  );
}

export function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">): React.ReactElement {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t border-outline bg-stone font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: React.ComponentProps<"tr">): React.ReactElement {
  return (
    <tr
      data-slot="table-row"
      className={cn("relative border-b border-outline transition-colors hover:bg-stone data-[state=selected]:bg-ink/5", className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ComponentProps<"th">): React.ReactElement {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-9 whitespace-nowrap px-2.5 text-left align-middle font-sans text-[13px] font-medium leading-none text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.ComponentProps<"td">): React.ReactElement {
  return (
    <td
      data-slot="table-cell"
      className={cn("whitespace-nowrap p-2.5 align-middle leading-none", className)}
      {...props}
    />
  );
}

export function TableCaption({ className, ...props }: React.ComponentProps<"caption">): React.ReactElement {
  return <caption data-slot="table-caption" className={cn("mt-4 text-[13px] text-ink-muted", className)} {...props} />;
}
