import { useEffect, useState } from "react";
import { twopinClient } from "../../lib/twopin-client.js";

interface TagFilterBarProps {
  activeTag: string | undefined;
  onSelect: (tag: string | undefined) => void;
}

/** Dumb partial: a row of tag chips for filtering the board's pins. Hidden when no tags exist. */
export function TagFilterBar({ activeTag, onSelect }: TagFilterBarProps) {
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);

  useEffect(() => {
    void twopinClient.listTags().then(setTags).catch(() => {});
  }, []);

  if (tags.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-outline px-4 py-2">
      <Chip label="All" active={!activeTag} onClick={() => onSelect(undefined)} />
      {tags.map((t) => (
        <Chip key={t.tag} label={`#${t.tag}`} count={t.count} active={activeTag === t.tag} onClick={() => onSelect(t.tag)} />
      ))}
    </div>
  );
}

function Chip({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active ? "border-outline bg-ink text-paper" : "border-outline bg-paper text-ink-muted hover:bg-stone hover:text-ink"
      }`}
    >
      {label}
      {count !== undefined && <span className={active ? "ml-1 text-paper/70" : "ml-1 text-ink-muted/60"}>{count}</span>}
    </button>
  );
}

