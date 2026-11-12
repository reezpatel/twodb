import { lazy, Suspense } from "react";
import { Link, useParams } from "react-router";
import { useBoardPage } from "./hooks/useBoardPage";

// Each editor is a big dependency tree (React Flow / CodeMirror + Mermaid): load only the one this board needs.
const BoardDiagram = lazy(() => import("../board-diagram/BoardDiagram").then((m) => ({ default: m.BoardDiagram })));
const BoardDoc = lazy(() => import("../board-doc/BoardDoc").then((m) => ({ default: m.BoardDoc })));

export function BoardPage() {
  const { id = "" } = useParams();
  const { board, error, rename } = useBoardPage(id);
  if (error)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-muted">
        <div>{error === "board_not_found" || error === "404" ? "This board doesn't exist, or isn't in your workspace." : error}</div>
        <Link to="/" className="underline">
          Back to boards
        </Link>
      </div>
    );
  if (!board) return <div className="p-6 text-ink-muted">Loading…</div>;
  const props = { boardId: board.id, name: board.name, onRename: (n: string) => void rename(n) };
  return (
    <Suspense fallback={<div className="p-6 text-ink-muted">Loading editor…</div>}>
      {board.kind === "doc" ? <BoardDoc key={board.id} {...props} /> : <BoardDiagram key={board.id} {...props} />}
    </Suspense>
  );
}
