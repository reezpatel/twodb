import { useState } from "react";
import { Brain, Check, Search, Sparkles, X } from "lucide-react";
import type { CachedModel } from "../../../lib/tworoute-client.js";

/**
 * Model list styled after the model-selector dropdown's row design (label +
 * provider, mono metric chips, thinking ✦), adapted to B+W tokens and our
 * cached-model data (no external deps — search filter + scroll inline).
 * Dumb — props in, rows out.
 */
export function ModelList({
  models,
  defaultModel,
  onLoad,
  onSetDefault,
}: {
  models: CachedModel[] | null;
  /** Current default — the matching row shows a check + "default" mark. */
  defaultModel?: string | null;
  onLoad: () => void;
  onSetDefault: (modelId: string) => void;
}) {
  if (!models) {
    return (
      <button className="flex w-full items-center gap-2 px-4 py-1.5 text-[13px] text-ink-muted hover:text-ink" onClick={onLoad}>
        <Sparkles className="size-3.5" />
        Load models
      </button>
    );
  }
  if (models.length === 0) {
    return (
      <div className="flex flex-col gap-1 px-4 py-2 text-center">
        <p className="text-[13px] font-medium text-ink-muted">No models found</p>
        <p className="text-[12px] text-ink-muted/70">Refresh pulls them from the provider.</p>
      </div>
    );
  }
  return <ModelListWithFilter models={models} defaultModel={defaultModel} onSetDefault={onSetDefault} />;
}

function ModelListWithFilter({
  models,
  defaultModel,
  onSetDefault,
}: {
  models: CachedModel[];
  defaultModel?: string | null;
  onSetDefault: (modelId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? models.filter((m) =>
        (m.modelId + " " + (m.displayName ?? "")).toLowerCase().includes(query.trim().toLowerCase()),
      )
    : models;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2">
      <div className="mb-2 flex shrink-0 items-center gap-2 border-b border-outline px-2 pb-2">
        <Search className="size-3.5 shrink-0 text-ink-muted" strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models…"
          className="w-full bg-transparent py-1 font-sans text-[13px] text-ink outline-none placeholder:text-ink-muted/60"
        />
        {query ? (
          <button
            aria-label="Clear search"
            className="shrink-0 text-ink-muted hover:text-ink"
            onClick={() => setQuery("")}
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-2 text-center text-[12px] text-ink-muted">
            Nothing matches "{query}" — try a different search.
          </p>
        ) : (
          filtered.map((m) => (
            <ModelRow key={m.modelId} m={m} isDefault={m.modelId === defaultModel} onSetDefault={onSetDefault} />
          ))
        )}
      </div>
    </div>
  );
}

/** One model row: display name + mono id on the left, metric chips right.
 * Clicking makes it the connection's default (PATCH default_model) — also
 * gives no-listing providers a testable default. */
function ModelRow({
  m,
  isDefault,
  onSetDefault,
}: {
  m: CachedModel;
  isDefault: boolean;
  onSetDefault: (modelId: string) => void;
}) {
  const fmtCost = (v: number | null) => (v === null ? null : `$${v < 10 ? v.toFixed(2) : v.toFixed(0)}/M`);
  const inPrice = fmtCost(m.costInput);
  const outPrice = fmtCost(m.costOutput);
  const ctx = m.contextWindow
    ? m.contextWindow >= 1_000_000
      ? `${(m.contextWindow / 1_000_000).toFixed(m.contextWindow % 1_000_000 === 0 ? 0 : 1)}M`
      : m.contextWindow >= 1000
        ? `${Math.round(m.contextWindow / 1000)}k`
        : String(m.contextWindow)
    : null;

  return (
    <button
      type="button"
      title={isDefault ? "Default model" : "Set as default model"}
      className={`flex w-full items-center gap-3 rounded-[6px] px-2.5 py-2 text-left outline-none transition-colors hover:bg-stone ${isDefault ? "bg-stone" : ""}`}
      onClick={() => onSetDefault(m.modelId)}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[14px] font-medium text-ink">{m.displayName ?? m.modelId}</span>
          {m.thinking ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-[4px] border border-outline bg-stone px-1 py-0.5 text-[10px] font-medium text-ink-muted">
              <Brain className="size-2.5" strokeWidth={2} />
              {m.thinkingLevel[0] ?? "think"}
            </span>
          ) : null}
        </span>
        <span className="flex items-center gap-1.5 truncate font-mono text-[11px] text-ink-muted">
          {isDefault ? <Check className="size-3 shrink-0 text-ink" strokeWidth={2.5} /> : null}
          {m.modelId}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {ctx ? (
          <span className="rounded-[4px] bg-stone px-1.5 py-0.5 font-mono text-[10px] leading-none text-ink-muted">
            {ctx} ctx
          </span>
        ) : null}
        {inPrice || outPrice ? (
          <span className="rounded-[4px] bg-stone px-1.5 py-0.5 font-mono text-[10px] leading-none text-ink-muted">
            {inPrice ?? "?"} / {outPrice ?? "?"}
          </span>
        ) : null}
      </div>
    </button>
  );
}
