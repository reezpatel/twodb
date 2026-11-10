import type { RegisteredAppSummary } from "../../../lib/gateway-client.js";
import { ExplorerAppCard } from "./ExplorerAppCard.js";

export interface AppCardGridProps {
  apps: RegisteredAppSummary[];
  selectedSlug: string | null;
  onExplore: (slug: string) => void;
}

/** Dumb/presentational only — grid of connect-style cards for the app list. */
export function AppCardGrid({ apps, selectedSlug, onExplore }: AppCardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {apps.map((app) => (
        <ExplorerAppCard
          key={app.slug}
          app={app}
          selected={selectedSlug === app.slug}
          onExplore={() => onExplore(app.slug)}
        />
      ))}
    </div>
  );
}
