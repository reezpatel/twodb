import type { SelectOption } from "@shared/model";
import { cn } from "@twodb/blocks";
import { OPTION_BG } from "../../lib/format";

export function OptionPill({ option, className, onRemove }: { option: Pick<SelectOption, "name" | "color">; className?: string; onRemove?: () => void }) {
  return (
    <span
      className={cn("inline-flex max-w-full items-center gap-1 truncate rounded-[5px] px-1.5 py-[1px] text-[12.5px] leading-[20px] text-ink", className)}
      style={{ background: OPTION_BG[option.color] ?? OPTION_BG.gray }}
    >
      <span className="truncate">{option.name}</span>
      {onRemove ? (
        <button type="button" className="-mr-0.5 text-ink-muted hover:text-ink" onClick={(e) => (e.stopPropagation(), onRemove())} aria-label={`Remove ${option.name}`}>
          ×
        </button>
      ) : null}
    </span>
  );
}
