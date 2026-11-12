import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import type { SuggestionListHandle } from "../lib/suggestion-popup";

export interface SuggestionEntry {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  group?: string;
}

export interface SuggestionListProps {
  items: SuggestionEntry[];
  onSelect: (item: SuggestionEntry) => void;
  emptyText?: string;
  loading?: boolean;
}

/** Keyboard-navigable floating list used by the slash menu and page mentions (AFFiNE-style grouped menu). */
export const SuggestionList = forwardRef<SuggestionListHandle, SuggestionListProps>(function SuggestionList({ items, onSelect, emptyText, loading }, ref) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setActive(0), [items]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (e) => {
      if (!items.length) return false;
      if (e.key === "ArrowDown") {
        setActive((i) => (i + 1) % items.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        setActive((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        const item = items[active];
        if (item) onSelect(item);
        return true;
      }
      return false;
    },
  }));

  let lastGroup: string | undefined;
  return (
    <div ref={listRef} className="twodb-menu" role="listbox">
      {items.length === 0 ? <div className="twodb-menu-empty">{loading ? "Searching…" : (emptyText ?? "No results")}</div> : null}
      {items.map((item, i) => {
        const header = item.group && item.group !== lastGroup ? item.group : null;
        lastGroup = item.group;
        return (
          <div key={item.id}>
            {header ? <div className="twodb-menu-group">{header}</div> : null}
            <button
              type="button"
              data-index={i}
              role="option"
              aria-selected={i === active}
              className={`twodb-menu-item ${i === active ? "is-active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item);
              }}
            >
              {item.icon ? <span className="twodb-menu-icon">{item.icon}</span> : null}
              <span className="twodb-menu-text">
                <span className="twodb-menu-title">{item.title || "Untitled"}</span>
                {item.description ? <span className="twodb-menu-desc">{item.description}</span> : null}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
});
