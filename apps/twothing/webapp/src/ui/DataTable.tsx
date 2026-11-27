import { cn } from "@twodb/blocks";
import type { ReactNode } from "react";

/** Control-panel (twodb app) list styling, shared by every Dispatch table. */

/** Rounded bordered card that wraps a table (or its empty state). */
export function TableCard({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-[6px] border border-outline bg-card shadow-[0_1px_2px_rgba(0,0,0,.025)]">{children}</div>;
}

export function TableEmpty({ children }: { children: ReactNode }) {
  return <p className="p-10 text-center text-[13px] text-ink-muted">{children}</p>;
}

/** Scrollable table with the uppercase header row; `columns` = header labels ("" = actions col). */
export function DataTable({ columns, minWidth = 720, children }: { columns: (string | { label: string; mobile?: boolean })[]; minWidth?: number; children: ReactNode }) {
  return (
    <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <table className="w-full border-collapse text-left" style={{ minWidth: minWidth || undefined }}>
        <thead>
          <tr className="border-b border-outline bg-stone/70 text-[10px] font-medium tracking-[0.09em] text-ink-muted uppercase">
            {columns.map((c, i) => {
              const col = typeof c === "string" ? { label: c, mobile: true } : { mobile: true, ...c };
              return (
                <th key={i} className={cn("h-10 px-3 py-0 align-middle font-medium sm:px-4", !col.mobile && "hidden md:table-cell")}>
                  {col.label || <span className="sr-only">Actions</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline">{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ onClick, className, children }: { onClick?: () => void; className?: string; children: ReactNode }) {
  return (
    <tr onClick={onClick} className={cn("group text-[12px] hover:bg-stone/50", onClick && "cursor-pointer", className)}>
      {children}
    </tr>
  );
}

/** `hideOnMobile` pairs with a `{ mobile: false }` column header. */
export function Td({ className, hideOnMobile, children }: { className?: string; hideOnMobile?: boolean; children: ReactNode }) {
  return <td className={cn("h-14 px-3 py-0 align-middle whitespace-nowrap sm:px-4", hideOnMobile && "hidden md:table-cell", className)}>{children}</td>;
}
