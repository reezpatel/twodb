import { ReactFlowProvider } from "@xyflow/react";
import { DiagramCanvas } from "./DiagramCanvas";

export function BoardDiagram(props: { boardId: string; name: string; onRename(name: string): void }) {
  return (
    <ReactFlowProvider>
      <DiagramCanvas {...props} />
    </ReactFlowProvider>
  );
}
