import type { PinDto } from "../../lib/twopin-client.js";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Dumb partial: read-only property list for a pin (URL, site, status, tags, added). */
export function PinProperties({ pin }: { pin: PinDto }) {
  const href = pin.finalUrl ?? pin.url;

  const row = (label: string, value: React.ReactNode) => (
    <div key={label} className="flex items-baseline gap-3 py-1">
      <dt className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm text-ink">{value}</dd>
    </div>
  );

  return (
    <dl className="divide-y divide-outline/50">
      {row(
        "URL",
        href ? (
          <a href={href} target="_blank" rel="noreferrer" className="break-all text-ion-deep hover:underline">
            {href}
          </a>
        ) : (
          "—"
        ),
      )}
      {row("Site", pin.siteName ?? "—")}
      {row("Status", pin.status)}
      {row(
        "Tags",
        pin.tags.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {pin.tags.map((t) => (
              <span key={t} className="rounded-full bg-stone px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                #{t}
              </span>
            ))}
          </span>
        ) : (
          "—"
        ),
      )}
      {row("Added", formatDate(pin.createdAt))}
    </dl>
  );
}

