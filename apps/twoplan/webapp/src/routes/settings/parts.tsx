import type { ReactNode } from "react";
import { PALETTE } from "../../lib/meta";

export function Group({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-outline py-6 first:pt-0 last:border-0">
      <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h2 className="text-[15px] font-semibold">{title}</h2>{hint ? <p className="mt-0.5 text-sm text-ink-muted">{hint}</p> : null}</div>{action}</div>
      {children}
    </section>
  );
}

export function ColorDot({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <label className="relative inline-flex size-5 shrink-0 cursor-pointer items-center justify-center" title="Change color">
      <span className="size-4 rounded-full ring-1 ring-black/10" style={{ background: value }} />
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Color" />
    </label>
  );
}
export const randomColor = () => PALETTE[Math.floor(Math.random() * PALETTE.length)];
export const rowCls = "flex items-center gap-2 rounded-md border border-outline px-3 py-1.5";
export const bareInput = "min-w-0 flex-1 rounded-sm bg-transparent px-1 py-1 text-sm outline-none hover:bg-stone focus:bg-stone";
