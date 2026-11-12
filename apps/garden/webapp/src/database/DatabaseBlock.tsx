import { Maximize2, Trash2 } from "lucide-react";
import type { DatabaseBlockProps } from "@twodb/editor";
import { useNavigate } from "react-router";
import { useDatabase, useGarden } from "../lib/queries";
import { RecordIcon } from "../ui/RecordIcon";
import { IconButton } from "../ui/IconButton";
import { DatabaseView } from "./DatabaseView";

/** Renders `databaseView` blocks inside notes (inline databases / linked views). */
export function DatabaseBlock({ databaseId, viewId, setViewId, remove, editable }: DatabaseBlockProps) {
  const db = useDatabase(databaseId);
  const garden = useGarden();
  const navigate = useNavigate();
  const d = db.data?.database;
  const header = (
    <div className="group/dbh mb-1 flex items-center gap-1.5">
      <RecordIcon icon={d?.icon} kind="database" size={20} />
      <input
        key={d?.title}
        defaultValue={d?.isDefaultDatabase ? "All docs" : d?.title}
        readOnly={!editable || d?.isDefaultDatabase}
        placeholder="Untitled database"
        onBlur={(e) => d && e.target.value !== d.title && void garden.patchRecord(d.id, { title: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="min-w-0 flex-1 bg-transparent text-[20px] font-bold tracking-[-0.01em] outline-none placeholder:text-ink-muted/60"
      />
      <div className="flex opacity-0 transition-opacity group-hover/dbh:opacity-100">
        <IconButton title="Open as full page" onClick={() => navigate(`/${databaseId}`)}>
          <Maximize2 size={14} />
        </IconButton>
        {editable ? (
          <IconButton title="Remove block" onClick={remove}>
            <Trash2 size={14} />
          </IconButton>
        ) : null}
      </div>
    </div>
  );
  return <DatabaseView databaseId={databaseId} viewId={viewId} onViewChange={setViewId} header={header} compact />;
}
