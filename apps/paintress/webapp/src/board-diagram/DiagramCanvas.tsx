import { Background, BackgroundVariant, ConnectionMode, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import { DiagramContext } from "./DiagramContext";
import { Palette } from "./Palette";
import { useBoardDiagram } from "./hooks/useBoardDiagram";
import { edgeTypes } from "./edges";
import { nodeTypes } from "./nodes";
import { Inspector } from "./partials/Inspector";
import { Toast } from "./partials/Toast";
import { Toolbar } from "./partials/Toolbar";
import { BoardHeader } from "../board/partials/BoardHeader";

/** The canvas: React Flow wired to the live board, plus palette, toolbar and inspector. */
export function DiagramCanvas({ boardId, name, onRename }: { boardId: string; name: string; onRename(name: string): void }) {
  const b = useBoardDiagram(boardId);
  const { cmd } = b;
  return (
    <DiagramContext.Provider value={b.actions}>
      <div className="flex h-full flex-col">
        <BoardHeader name={name} status={b.status} presence={b.presence} onRename={onRename} />
        <div className="relative min-h-0 flex-1" onDrop={b.onDrop} onDragOver={b.onDragOver}>
          <ReactFlow
            nodes={b.nodes}
            edges={b.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={b.onNodesChange}
            onEdgesChange={b.onEdgesChange}
            onConnect={cmd.connect}
            onNodeDragStop={(_e, _n, dragged) => cmd.dragEnded(dragged)}
            connectionMode={ConnectionMode.Loose}
            deleteKeyCode={null}
            selectionOnDrag={b.tool === "select"}
            panOnDrag={b.tool === "hand" ? true : [1, 2]}
            panActivationKeyCode="Space"
            nodesDraggable={b.tool === "select" && b.canEdit}
            nodesConnectable={b.canEdit}
            snapToGrid
            snapGrid={[8, 8]}
            minZoom={0.1}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.4} />
            <MiniMap pannable zoomable className="!bottom-3 !right-3" style={{ marginRight: b.selectedItem ? 272 : 0 }} />
            <Controls showInteractive={false} className="!bottom-3 !left-72" />
          </ReactFlow>

          <Palette
            disabled={!b.canEdit}
            actions={{
              addShape: (p, s) => cmd.addShape(p, s),
              addGroup: (s) => cmd.addGroup(s),
              addIcon: (i, l) => cmd.addIcon(i, l),
              addEntity: () => cmd.addEntity(),
              addPool: () => cmd.addPool(),
              addSticky: () => cmd.addSticky(),
              addText: () => cmd.addText(),
              addImage: (f) => void cmd.addImage(f),
            }}
          />
          <Toolbar
            tool={b.tool}
            onTool={b.setTool}
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
