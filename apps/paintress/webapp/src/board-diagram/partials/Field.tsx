import type { ReactNode } from "react";

export function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{props.label}</span>
      {props.children}
    </label>
  );
}

export const inputClass = "h-8 w-full rounded-sm border border-outline bg-paper px-2 text-[13px] text-ink outline-none focus:border-ion-deep";

/** Text input that commits on blur / Enter (so typing is not one undo step per keystroke). */
export function CommitInput(props: { value: string; onCommit(v: string): void; placeholder?: string; type?: string }) {
  return (
    <input
      key={props.value}
      type={props.type ?? "text"}
      defaultValue={props.value}
      placeholder={props.placeholder}
      className={inputClass}
      onBlur={(e) => e.currentTarget.value !== props.value && props.onCommit(e.currentTarget.value)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

export function Select(props: { value: string; options: [string, string][]; onChange(v: string): void }) {
  return (
    <select value={props.value} onChange={(e) => props.onChange(e.target.value)} className={inputClass}>
      {props.options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
