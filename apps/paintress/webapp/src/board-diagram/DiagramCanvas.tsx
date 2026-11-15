import { DiagramContext } from "./DiagramContext";
import { ToolDock } from "./ToolDock";
import { useBoardDiagram } from "./hooks/useBoardDiagram";
import { Inspector } from "./partials/Inspector";
import { Toast } from "./partials/Toast";
import { Toolbar } from "./partials/Toolbar";
import { BoardHeader } from "../board/partials/BoardHeader";
import { Canvas } from "../svg-canvas/Canvas";

/** The board screen: header + SVG canvas + palette, toolbar and inspector. */
export function DiagramCanvas({ boardId, name, sidebar, onRename }: { boardId: string; name: string; sidebar?: { open: boolean; onToggle(): void }; onRename(name: string): void }) {
  const b = useBoardDiagram(boardId);
  const { cmd } = b;
  return (
    <DiagramContext.Provider value={b.actions}>
      <div className="flex h-full flex-col">
        <BoardHeader name={name} status={b.status} presence={b.presence} onRename={onRename} sidebar={sidebar} />
        <div className="relative min-h-0 flex-1" onDrop={b.onDrop} onDragOver={b.onDragOver}>
          <Canvas
            items={b.items}
            canEdit={b.canEdit}
            tool={b.tool}
            penColor={b.penColor}
            armed={b.armed}
            flash={b.flash}
            selection={b.selection}
            setSelection={b.setSelection}
            fitSignal={b.fitSignal}
            cmd={b.canvas}
          />

          <ToolDock disabled={!b.canEdit} tool={b.tool} onTool={b.setTool} armed={b.armed} arm={b.arm} addImage={(f) => void cmd.addImage(f)} />
          <Toolbar
            canUndo={b.history.canUndo}
            canRedo={b.history.canRedo}
            undoLabel={b.history.undoLabel}
            redoLabel={b.history.redoLabel}
            onUndo={() => void cmd.undo()}
            onRedo={() => void cmd.redo()}
            onTidy={() => void cmd.tidy()}
            onFit={b.fit}
            disabled={!b.canEdit}
          />
          {b.selectedItem && (
            <Inspector
              item={b.selectedItem}
              disabled={!b.canEdit}
              onPatch={(p, l) => cmd.patch(b.selectedItem!.id, p, l)}
              onDelete={() => cmd.deleteIds([b.selectedItem!.id])}
              onDuplicate={() => cmd.duplicate([b.selectedItem!.id])}
              onAddLane={() => cmd.addLane(b.selectedItem!.id)}
            />
          )}
          {b.armed && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-outline bg-popover px-3 py-1 text-[12px] text-ink-muted shadow-lg">
              Drag on the canvas to size it — click to place, Esc to cancel
            </div>
          )}
          {!b.loaded && <div className="absolute inset-0 z-30 flex items-center justify-center bg-paper/70 text-ink-muted">Loading board…</div>}
          {b.loaded && b.status !== "open" && (
            <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-full bg-warning px-4 py-1 text-[12px] text-warning-foreground">Reconnecting — editing is paused</div>
          )}
          <Toast message={b.toast.message} onDismiss={b.toast.dismiss} />
        </div>
      </div>
    </DiagramContext.Provider>
  );
}
