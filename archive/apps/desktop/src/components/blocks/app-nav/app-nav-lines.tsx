import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AppNavVariant } from "./app-nav-context";

interface AppNavLinesProps {
  /** Y position of each row's elbow. */
  offsets: number[];
  selectedOffset: number | null;
  variant: AppNavVariant;
  activeColor: string;
}

/** The branch drawn down the left of a list: a trunk with an elbow into every row, plus a highlighted elbow on the selected one. */
export function AppNavLines({ offsets, selectedOffset, variant, activeColor }: AppNavLinesProps) {
  if (offsets.length === 0) return null;
  const last = offsets[offsets.length - 1];
  const height = last + 1;
  const elbow = (y: number) => `M0.5 ${y - 5} Q0.5 ${y} 5.5 ${y} H11.5`;
  const selectedPath = selectedOffset === null ? null : `M0.5 0 V${selectedOffset - 5} Q0.5 ${selectedOffset} 5.5 ${selectedOffset} H11.5`;

  return (
    <svg
      aria-hidden="true"
      width="12"
      height={height}
      viewBox={`0 0 12 ${height}`}
      fill="none"
      className="text-border pointer-events-none absolute top-0 left-[12.5px] z-10 select-none"
    >
      <path d={`M0.5 0 V${last - 5}`} stroke="currentColor" strokeWidth="1" />
      {offsets.map((y) => (
        <path key={y} d={elbow(y)} stroke="currentColor" strokeWidth="1" />
      ))}
      {variant === "line" && selectedPath ? (
        <motion.path
          d={selectedPath}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={cn(activeColor)}
          initial={false}
          animate={{ d: selectedPath }}
          transition={{ type: "spring", stiffness: 450, damping: 35 }}
        />
      ) : null}
    </svg>
  );
}
