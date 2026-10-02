import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ReactRenderer } from "@tiptap/react";
import { Folder } from "lucide-react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";

export type { SuggestionKeyDownProps };
import { cn } from "@/lib/utils";

export interface SuggestionItem {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  folder?: boolean;
}

export interface SuggestionPopupHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

type PopupProps = SuggestionProps<SuggestionItem>;

/**
 * Floating list above the caret. The editor keeps keyboard focus — the
 * suggestion plugin forwards key events to `onKeyDown` imperatively.
 */
const SuggestionPopup = forwardRef<SuggestionPopupHandle, PopupProps>((props, ref) => {
  const [selected, setSelected] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const items = props.items;

  useEffect(() => {
    setSelected(0);
    setDismissed(false);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % Math.max(1, items.length));
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelected((s) => (s - 1 + items.length) % Math.max(1, items.length));
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const item = items[selected];
        if (!item) return false;
        props.command(item);
        return true;
      }
      if (event.key === "Escape") {
        setDismissed(true);
        return true;
      }
      return false;
    },
  }));

  const rect = props.clientRect?.();
  if (dismissed || items.length === 0 || !rect) return null;

  let flatIndex = -1;
  let lastGroup: string | undefined;

  return (
    <div
      className="bg-popover text-popover-foreground fixed z-50 w-80 overflow-hidden rounded-lg border shadow-lg"
      style={{ left: Math.max(8, Math.min(rect.left, window.innerWidth - 336)), top: Math.max(8, rect.top - 6), transform: "translateY(-100%)" }}
    >
      {items.map((item, i) => {
        flatIndex += 1;
        const showGroup = item.group !== lastGroup;
        lastGroup = item.group;
        return (
          <div key={item.id}>
            {showGroup && item.group ? (
              <p className="text-muted-foreground border-b px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase">{item.group}</p>
            ) : null}
            <button
              type="button"
              className={cn("hover:bg-accent/50 flex w-full items-center gap-2 px-2.5 py-1.5 text-left", i === selected && "bg-accent")}
              onMouseEnter={() => setSelected(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                props.command(item);
              }}
            >
              {item.folder ? <Folder size={11} className="text-muted-foreground shrink-0" aria-hidden="true" /> : null}
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{item.label}</span>
              {item.hint ? <span className="text-muted-foreground shrink-0 truncate text-[10px]">{item.hint}</span> : null}
            </button>
          </div>
        );
      })}
    </div>
  );
});

SuggestionPopup.displayName = "SuggestionPopup";

/** tiptap suggestion render() factory — mounts the popup via ReactRenderer and appends it to the document (ReactRenderer's element is detached by default). `openRef` reflects "popup active with items" so the composer's Enter-submit can yield. */
export function suggestionRenderer(openRef: { current: boolean }) {
  let renderer: ReactRenderer<SuggestionPopupHandle, PopupProps> | null = null;
  return {
    onStart(props: PopupProps) {
      openRef.current = props.items.length > 0;
      renderer = new ReactRenderer(SuggestionPopup, { props, editor: props.editor });
      document.body.appendChild(renderer.element);
    },
    onUpdate(props: PopupProps) {
      openRef.current = props.items.length > 0;
      renderer?.updateProps(props);
    },
    onKeyDown(props: SuggestionKeyDownProps) {
      return renderer?.ref?.onKeyDown(props.event) ?? false;
    },
    onExit() {
      openRef.current = false;
      const current = renderer;
      renderer = null;
      current?.destroy();
      current?.element.remove();
    },
  };
}
