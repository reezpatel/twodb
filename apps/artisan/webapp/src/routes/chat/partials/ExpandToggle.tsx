import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useExpandToggle } from "../hooks/useExpandToggle.js";

/** Header button: expand / collapse all thinking + tool blocks (the touch equivalent of pressing O). */
export function ExpandToggle({ className = "" }: { className?: string }) {
  const { expanded, toggle } = useExpandToggle();
  const label = expanded ? "Collapse all blocks" : "Expand all blocks";
  return (
    <button
      type="button"
      data-slot="expand-toggle"
      aria-label={label}
      aria-pressed={expanded}
      title={`${label} (O)`}
      onClick={toggle}
      className={`rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink ${expanded ? "bg-surface-muted text-ink" : ""} ${className}`}
    >
      {expanded ? <ChevronsDownUp className="size-4" /> : <ChevronsUpDown className="size-4" />}
    </button>
  );
}
