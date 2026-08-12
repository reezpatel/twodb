import type { HTMLAttributes, ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { tableStyles } from "./Table.style";

export function Table({ children, className = "", ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="tw-table-wrap">
      <style jsx>{tableStyles}</style>
      <div className="tw-table-scroll">
        <table className={["tw-table", className].filter(Boolean).join(" ")} {...rest}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function THead({ children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className="tw-thead" {...rest}>
      {children}
    </thead>
  );
}

export function TBody({ children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className="tw-tbody" {...rest}>
      {children}
    </tbody>
  );
}

export function TR({ children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className="tw-tr" {...rest}>
      {children}
    </tr>
  );
}

export interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right";
  children: ReactNode;
}

export function TH({ align = "left", children, ...rest }: THProps) {
  return (
    <th className={["tw-th", align === "right" ? "tw-th--right" : ""].filter(Boolean).join(" ")} {...rest}>
      {children}
    </th>
  );
}

export interface TDProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right";
  children: ReactNode;
}

export function TD({ align = "left", children, ...rest }: TDProps) {
  return (
    <td className={["tw-td", align === "right" ? "tw-td--right" : ""].filter(Boolean).join(" ")} {...rest}>
      {children}
    </td>
  );
}
