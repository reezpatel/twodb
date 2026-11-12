/** Dumb/presentational — placeholder rows while the app list loads (same silhouette as AppRow). */
export function AppsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading apps" className="overflow-hidden rounded-xl border border-outline bg-card">
      <div className="divide-y divide-outline">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 animate-pulse rounded-sm bg-stone" />
              <div className="h-2.5 w-20 animate-pulse rounded-sm bg-stone/70" />
            </div>
            <div className="hidden h-3 w-24 animate-pulse rounded-sm bg-stone sm:block" />
            <div className="hidden h-3 w-16 animate-pulse rounded-sm bg-stone sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
