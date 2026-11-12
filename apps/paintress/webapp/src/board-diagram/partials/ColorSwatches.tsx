const COLORS = ["#ffffff", "#fde68a", "#fecaca", "#fed7aa", "#bbf7d0", "#bfdbfe", "#ddd6fe", "#fbcfe8", "#e2e8f0"];

export function ColorSwatches(props: { value?: string; onPick(c: string | null): void; allowClear?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Colour ${c}`}
          onClick={() => props.onPick(c)}
          className={`size-5 rounded-full border ${props.value === c ? "border-ink ring-2 ring-ion-deep" : "border-slate-300"}`}
          style={{ background: c }}
        />
      ))}
      {props.allowClear && (
        <button type="button" onClick={() => props.onPick(null)} className="text-[11px] text-ink-muted underline">
          reset
        </button>
      )}
    </div>
  );
}
