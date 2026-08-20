import type { ReactNode } from "react";
import { overlayStyles } from "./overlay.style";

export type TooltipSide = "top" | "right";

export interface TooltipProps {
  tip: string;
  side?: TooltipSide;
  children: ReactNode;
}

export function Tooltip({ tip, side = "top", children }: TooltipProps) {
  return (
    <span className={`tw-tip tw-tip--${side}`} data-tip={tip}>
      <style jsx>{overlayStyles}</style>
      {children}
    </span>
  );
}
