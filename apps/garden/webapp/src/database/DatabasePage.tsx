import { useSearchParams } from "react-router";
import { Smile } from "lucide-react";
import type { RecordDetail } from "@shared/model";
import { useGarden } from "../lib/queries";
import { Popover } from "../ui/Popover";
import { EmojiPicker, randomEmoji } from "../ui/EmojiPicker";
import { PageTitle } from "../doc/partials/PageTitle";
import { DatabaseView } from "./DatabaseView";

/** Full-page database (also "All docs" = the space's default Notes database). */
export function DatabasePage({ record }: { record: RecordDetail }) {
  const garden = useGarden();
  const [params, setParams] = useSearchParams();
  const isDefault = !!record.isDefaultDatabase;
  const setView = (id: string) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set("view", id);
      return n;
    });
  return (
    <div className="px-6 pb-16 pt-12 sm:px-16">
      <div className="group/head mx-auto max-w-[1400px]">
        {isDefault ? (
          <h1 className="mb-1 text-[32px] font-bold tracking-[-0.02em]">All docs</h1>
        ) : (
          <>
            {record.icon ? (
              <Popover trigger={<button type="button" className="mb-1 flex size-14 items-center justify-center rounded-lg text-[44px] hover:bg-ink/[0.05]">{record.icon}</button>}>
                <EmojiPicker onPick={(icon) => void garden.patchRecord(record.id, { icon })} onRemove={() => void garden.patchRecord(record.id, { icon: null })} />
              </Popover>
            ) : (
              <button type="button" onClick={() => void garden.patchRecord(record.id, { icon: randomEmoji() })} className="mb-1 flex h-7 items-center gap-1 rounded-md px-1.5 text-[13px] text-ink-muted opacity-0 hover:bg-ink/[0.05] group-hover/head:opacity-100">
                <Smile size={14} /> Add icon
              </button>
            )}
            <PageTitle value={record.title} placeholder="Untitled database" onChange={(title) => void garden.patchRecord(record.id, { title })} onEnter={() => undefined} />
          </>
        )}
        <div className="mt-5">
          <DatabaseView databaseId={record.id} viewId={params.get("view")} onViewChange={setView} />
        </div>
      </div>
    </div>
  );
}
