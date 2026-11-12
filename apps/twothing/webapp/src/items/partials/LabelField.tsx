import { cn } from "@twodb/blocks";
import { CircleCheck, CircleX, Loader2, QrCode, ScanLine, Sparkles } from "lucide-react";
import type { LabelStatus } from "../hooks/useItemEditor";

/** Our printed label: scan the sticker you just stuck on, type it, or auto-generate on save. */
export function LabelField({
  code,
  status,
  autoCode,
  onChange,
  onScan,
  onAuto,
  entity = "item",
}: {
  code: string;
  status: LabelStatus;
  autoCode: boolean;
  onChange: (v: string) => void;
  onScan: () => void;
  onAuto: (on: boolean) => void;
  entity?: "item" | "place";
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <QrCode className="pointer-events-none absolute top-3 left-3 size-4 text-ink-muted" />
          <input
            value={code}
            onChange={(e) => onChange(e.target.value)}
            placeholder={autoCode ? "Will be generated on save" : "e.g. K7Q-M2X"}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className={cn(
              "h-11 w-full rounded-xl border bg-paper pr-3 pl-9 font-mono text-[16px] font-semibold tracking-[0.15em] uppercase outline-none placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:normal-case placeholder:text-ink-muted",
              status.state === "taken" ? "border-destructive" : status.state === "free" || status.state === "mine" ? "border-emerald-500/60" : "border-outline",
            )}
          />
        </div>
        <button type="button" onClick={onScan} className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-semibold text-paper active:scale-95">
          <ScanLine className="size-4" /> Scan
        </button>
      </div>
      <div className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {status.state === "checking" && (
          <span className="inline-flex items-center gap-1 text-ink-muted">
            <Loader2 className="size-3 animate-spin" /> Checking…
          </span>
        )}
        {status.state === "free" && (
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <CircleCheck className="size-3.5" /> Free label{status.inPool ? " from your printed batch" : ""}
          </span>
        )}
        {status.state === "mine" && (
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <CircleCheck className="size-3.5" /> Current label
          </span>
        )}
        {status.state === "taken" && (
          <span className="inline-flex items-center gap-1 text-destructive">
            <CircleX className="size-3.5" /> Already on {status.by}
          </span>
        )}
        {status.state === "custom" && <span className="text-ink-muted">Custom code (not a TwoThing label format)</span>}
        {status.state === "empty" && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-ink-muted select-none hover:text-ink">
            <input type="checkbox" checked={autoCode} onChange={(e) => onAuto(e.target.checked)} className="accent-[var(--ink)]" />
            <Sparkles className="size-3.5" /> Generate a fresh label for this {entity} on save
          </label>
        )}
      </div>
    </div>
  );
}
