import { Checkbox } from "@/components/ui/checkbox";
import type { CellDisplayProps } from "./types";

/**
 * Checkbox cell: the display view IS the editor — clicking the Radix Checkbox
 * fires `onCommit` directly, no floating editor. The wrapping element is a
 * `<div>` (not a `<button>`) because Radix Checkbox already renders a
 * `<button>` and HTML forbids nested buttons.
 */
export function CheckboxCellDisplay({ value, onCommit }: CellDisplayProps) {
  return (
    <div className="hover:bg-accent/40 -mx-2 flex h-full min-h-[24px] cursor-pointer items-center justify-center rounded px-2 text-xs">
      <Checkbox checked={Boolean(value)} onCheckedChange={(checked) => onCommit(checked)} className="h-4 w-4" />
    </div>
  );
}
