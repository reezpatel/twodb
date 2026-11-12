/** Dumb/presentational — scope chips; an empty scope list renders a dash. */
export function ScopeList({ scopes }: { scopes: string[] }) {
  if (scopes.length === 0) return <span className="text-ink-muted">—</span>;
  return (
    <span className="grid w-[92px] grid-cols-2 gap-1">
      {scopes.map((scope) => (
        <span key={scope} className="grid h-6 min-w-0 place-items-center rounded-md border border-outline px-1.5 text-ink-muted">
          <span className="block truncate font-mono text-[9.5px] leading-none">{scope}</span>
        </span>
      ))}
    </span>
  );
}
