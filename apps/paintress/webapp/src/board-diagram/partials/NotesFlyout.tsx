import { sameSpec, type ArmedSpec } from "../hooks/usePlacement";
import { PaletteItem } from "./PaletteItem";

/** Sticky-note colours offered in the notes flyout. */
export const STICKY_COLORS = [
  ["#fde68a", "Yellow"],
  ["#fbcfe8", "Pink"],
  ["#bfdbfe", "Blue"],
  ["#bbf7d0", "Green"],
  ["#e9d5ff", "Purple"],
  ["#fed7aa", "Orange"],
] as const;

/** Notes flyout: pick a colour, then drag the note out on the canvas. */
export function NotesFlyout(props: { armed: ArmedSpec | null; onArm(color: string): void }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {STICKY_COLORS.map(([color, label]) => (
        <PaletteItem key={color} title={`${label} note`} label={label} payload={{ kind: "sticky", color }} active={sameSpec(props.armed, { kind: "sticky", color })} onClick={() => props.onArm(color)}>
          <div className="h-9 w-10 rounded-sm shadow-sm" style={{ background: color, transform: "rotate(-2deg)" }} />
        </PaletteItem>
      ))}
    </div>
  );
}
