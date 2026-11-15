import type { ReactNode } from "react";

/** A draggable / clickable palette cell. Payload travels in dataTransfer; the canvas decodes it on drop. */
export function PaletteItem(props: { payload: object; title: string; onClick(): void; children: ReactNode; label?: string; active?: boolean }) {
  return (
    <button
      type="button"
      title={props.title}
      aria-label={props.title}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/paintress", JSON.stringify(props.payload));
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={props.onClick}
      className={`flex min-w-0 flex-col items-center gap-1 rounded-sm border p-1.5 text-center hover:border-outline hover:bg-paper-grid ${props.active ? "border-ion-deep bg-paper-grid ring-1 ring-ion-deep" : "border-transparent"}`}
    >
      <div className="flex h-10 w-full items-center justify-center">{props.children}</div>
      {props.label && <span className="w-full truncate text-[10px] text-ink-muted">{props.label}</span>}
    </button>
  );
}
