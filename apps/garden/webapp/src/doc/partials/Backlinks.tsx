import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "@twodb/blocks";
import { useBacklinks } from "../../lib/queries";
import { RecordIcon } from "../../ui/RecordIcon";

/** "Backlinks · n" — pages that mention this one. */
export function Backlinks({ id }: { id: string }) {
  const { data } = useBacklinks(id);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const list = data?.backlinks ?? [];
  if (!list.length) return null;
  return (
    <div className="mt-10 border-t border-outline pt-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-[13px] font-medium text-ink-muted hover:text-ink">
        <ChevronRight size={14} className={cn("transition-transform", open && "rotate-90")} />
        Backlinks · {list.length}
      </button>
      {open ? (
        <div className="mt-2 space-y-1">
          {list.map((b) => (
            <button key={b.id} type="button" onClick={() => navigate(`/${b.id}`)} className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-ink/[0.04]">
              <span className="flex items-center gap-1.5 text-[13.5px] font-medium">
                <RecordIcon icon={b.icon} kind={b.kind} size={14} /> {b.title || "Untitled"}
              </span>
              {b.snippet ? <span className="mt-0.5 block truncate pl-5 text-[12.5px] text-ink-muted">{b.snippet}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
