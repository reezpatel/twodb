import type { ReactNode } from "react";

/** Shared dumb widget building blocks — B+W tokens, no state. */

export function Shell({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex h-full flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[14px] leading-none">
        <h3 className="truncate text-[12px] font-semibold tracking-wide text-ink-muted uppercase">{title}</h3>
        {meta ? <span className="shrink-0 text-[13px] text-ink-muted">{meta}</span> : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

export function Big({ children, unit }: { children: ReactNode; unit?: string }) {
  return (
    <p className="text-[28px] leading-none font-normal tracking-tight text-ink tabular-nums">
      {children}
      {unit ? (
        <span className="text-[13px] tracking-normal text-ink-muted">
          {"\u00a0"}
          {unit}
        </span>
      ) : null}
    </p>
  );
}

export function Delta({ value, good = "up" }: { value: number; good?: "up" | "down" }) {
  const up = value >= 0;
  const tone = up === (good === "up") ? "text-success" : "text-destructive";
  return (
    <span className={`text-[14px] tabular-nums ${tone}`}>
      <span aria-hidden="true">{up ? "↑" : "↓"} </span>
      {Math.abs(value)}%
    </span>
  );
}

export function Dot({ tone, pulse = false }: { tone: "ok" | "warn" | "err" | "idle"; pulse?: boolean }) {
  const bg =
    tone === "ok" ? "bg-success" : tone === "warn" ? "bg-warning" : tone === "err" ? "bg-destructive" : "bg-ink-muted/60";
  return (
    <span aria-hidden="true" className="relative inline-flex size-2 shrink-0">
      {pulse ? <span className={`absolute inset-0 animate-ping rounded-full opacity-50 motion-reduce:hidden ${bg}`} /> : null}
      <span className={`relative size-2 rounded-full ${bg}`} />
    </span>
  );
}

export function Row({ children, value }: { children: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <dt className="flex min-w-0 items-center gap-2 truncate text-ink">{children}</dt>
      <dd className="ml-auto text-ink-muted tabular-nums">{value}</dd>
    </div>
  );
}
