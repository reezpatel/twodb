import { useRef } from "react";
import { Image as ImageIcon, Rows3 } from "lucide-react";
import { sameSpec, type ArmedSpec } from "../hooks/usePlacement";
import { PaletteItem } from "./PaletteItem";

/** Others flyout: swimlanes and image upload. */
export function OthersFlyout(props: { armed: ArmedSpec | null; onArm(spec: ArmedSpec): void; addImage(file: File): void }) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="grid grid-cols-2 gap-1">
      <PaletteItem title="Swimlanes (pool with lanes)" label="Swimlanes" payload={{ kind: "pool" }} active={sameSpec(props.armed, { kind: "pool" })} onClick={() => props.onArm({ kind: "pool" })}>
        <Rows3 className="size-6 text-ink-muted" />
      </PaletteItem>
      <button type="button" onClick={() => file.current?.click()} className="flex flex-col items-center gap-1 rounded-sm border border-transparent p-1.5 hover:border-outline hover:bg-paper-grid">
        <div className="flex h-10 items-center">
          <ImageIcon className="size-6 text-ink-muted" />
        </div>
        <span className="text-[10px] text-ink-muted">Image</span>
      </button>
      <input
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) props.addImage(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
