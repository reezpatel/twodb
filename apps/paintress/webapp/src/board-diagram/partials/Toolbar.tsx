import type { ReactNode } from "react";
import { Hand, LayoutTemplate, Maximize, MousePointer2, Redo2, Undo2 } from "lucide-react";
import type { Tool } from "../hooks/useBoardDiagram";

function Btn(props: { title: string; active?: boolean; disabled?: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={props.title}
      aria-label={props.title}
      disabled={props.disabled}
      onClick={props.onClick}
      className={`flex size-8 items-center justify-center rounded-full ${props.active ? "bg-ink text-paper" : "text-ink hover:bg-paper-grid"} disabled:opacity-35`}
    >
      {props.children}
    </button>
  );
}

/** Top-centre tool strip: select/hand, undo/redo (labelled with what they'll undo), tidy up, fit. */
export function Toolbar(props: {
  tool: Tool;
  onTool(t: Tool): void;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel?: string;
  redoLabel?: string;
  onUndo(): void;
  onRedo(): void;
  onTidy(): void;
  onFit(): void;
  disabled: boolean;
}) {
  return (
    <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-outline bg-popover px-1.5 py-1 shadow-lg">
      <Btn title="Select (V)" active={props.tool === "select"} onClick={() => props.onTool("select")}>
        <MousePointer2 className="size-4" />
      </Btn>
      <Btn title="Pan (H, or hold Space)" active={props.tool === "hand"} onClick={() => props.onTool("hand")}>
        <Hand className="size-4" />
      </Btn>
      <span className="mx-1 h-5 w-px bg-outline" />
      <Btn title={props.undoLabel ? `Undo: ${props.undoLabel} (Ctrl+Z)` : "Undo (Ctrl+Z)"} disabled={!props.canUndo || props.disabled} onClick={props.onUndo}>
        <Undo2 className="size-4" />
      </Btn>
      <Btn title={props.redoLabel ? `Redo: ${props.redoLabel} (Ctrl+Shift+Z)` : "Redo (Ctrl+Shift+Z)"} disabled={!props.canRedo || props.disabled} onClick={props.onRedo}>
        <Redo2 className="size-4" />
      </Btn>
      <span className="mx-1 h-5 w-px bg-outline" />
      <Btn title="Tidy up — auto-layout (keeps items you placed by hand)" disabled={props.disabled} onClick={props.onTidy}>
        <LayoutTemplate className="size-4" />
      </Btn>
      <Btn title="Fit to screen (F)" onClick={props.onFit}>
        <Maximize className="size-4" />
      </Btn>
    </div>
  );
}
