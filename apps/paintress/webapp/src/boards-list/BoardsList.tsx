import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus } from "lucide-react";
import { Button } from "@twodb/blocks";
import { useBoardsList } from "./hooks/useBoardsList";
import { BoardCard } from "./partials/BoardCard";
import { NewBoardDialog } from "./partials/NewBoardDialog";

export function BoardsList() {
  const { boards, spaces, error, create, remove } = useBoardsList();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const spaceName = (id: string) => spaces.find((s) => s.id === id)?.name;

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 overflow-auto p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Paintress</h1>
          <p className="text-sm text-ink-muted">Diagrams and docs you and your agents edit together.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus /> New board
        </Button>
      </div>
      {error && <div className="text-destructive">{error}</div>}
      {boards && boards.length === 0 && <div className="rounded-md border border-dashed border-outline p-10 text-center text-ink-muted">No boards yet — create one.</div>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {boards?.map((b) => (
          <BoardCard
            key={b.id}
            board={b}
            spaceName={spaceName(b.spaceId)}
            onOpen={() => navigate(`/b/${b.id}`)}
            onDelete={() => window.confirm(`Delete "${b.name}"?`) && void remove(b.id)}
          />
        ))}
      </div>
      <NewBoardDialog
        open={creating}
        spaces={spaces}
        onClose={() => setCreating(false)}
        onCreate={async (input) => {
          const b = await create(input);
          setCreating(false);
          navigate(`/b/${b.id}`);
        }}
      />
    </div>
  );
}
