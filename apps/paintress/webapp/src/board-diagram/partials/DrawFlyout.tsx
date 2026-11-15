import { Check, Eraser, Highlighter, PenLine } from "lucide-react";
import type { Tool } from "../hooks/useBoardDiagram";

const TOOLS = [
  ["pen", "Pen", PenLine],
  ["highlighter", "Highlighter", Highlighter],
  ["eraser", "Eraser", Eraser],
] as const;

/** Draw flyout: pick the active drawing tool (stays active until you switch back to select). */
export function DrawFlyout(props: { tool: Tool; onPick(t: "pen" | "highlighter" | "eraser"): void }) {
  return (
    <div className="flex flex-col gap-0.5">
      {TOOLS.map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          onClick={() => props.onPick(id)}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] ${props.tool === id ? "bg-paper-grid font-semibold text-ink" : "text-ink hover:bg-paper-grid"}`}
        >
          <Icon className="size-4" />
          <span className="flex-1">{label}</span>
          {props.tool === id && <Check className="size-3.5" />}
        </button>
      ))}
    </div>
  );
}
