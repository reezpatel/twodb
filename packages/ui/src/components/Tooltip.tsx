import type { ReactNode } from "react";

export interface TooltipProps {
  tip: string;
  children: ReactNode;
}

export function Tooltip({ tip, children }: TooltipProps) {
  return (
    <span className="tw-tip" data-tip={tip}>
      {children}
    </span>
  );
}
