import { useRef, useState } from "react";
import type { Field } from "@shared/model";
import { Popover } from "../../ui/Popover";
import { FieldIcon } from "../fields/fieldMeta";
import { FieldMenu, type FieldMenuActions } from "../fields/FieldMenu";

/** Column header: click → field menu, drag the right edge → resize (persisted on release). */
export function TableHeaderCell({ field, fields, width, onResize, actions }: { field: Field; fields: Field[]; width: number; onResize: (w: number) => void; actions: FieldMenuActions }) {
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState<number | null>(null);
  const start = useRef<{ x: number; w: number } | null>(null);
  const w = live ?? width;

  const onDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    start.current = { x: e.clientX, w: width };
    const move = (ev: MouseEvent) => start.current && setLive(Math.max(80, Math.min(800, start.current.w + ev.clientX - start.current.x)));
    const up = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (start.current) onResize(Math.max(80, Math.min(800, start.current.w + ev.clientX - start.current.x)));
      start.current = null;
      setTimeout(() => setLive(null), 300);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div className="relative shrink-0 border-r border-outline/70 last:border-r-0" style={{ width: w }}>
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger={
          <button type="button" className="flex h-[34px] w-full items-center gap-1.5 px-2 text-left text-[13px] text-ink-muted hover:bg-ink/[0.04]">
            <FieldIcon type={field.type} size={13} />
            <span className="truncate">{field.name}</span>
            {field.error ? <span className="text-destructive" title={field.error}>!</span> : null}
          </button>
        }
      >
        <FieldMenu field={field} fields={fields} actions={{ ...actions, onClose: () => setOpen(false) }} />
      </Popover>
      <div onMouseDown={onDown} className="absolute -right-[3px] top-0 z-10 h-full w-[6px] cursor-col-resize hover:bg-ion-deep/40" />
    </div>
  );
}
