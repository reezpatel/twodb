import { DiagramCanvas } from "./DiagramCanvas";

export function BoardDiagram(props: { boardId: string; name: string; sidebar?: { open: boolean; onToggle(): void }; onRename(name: string): void }) {
  return <DiagramCanvas {...props} />;
}
