import { Tabs, TabsList, TabsTrigger } from "@twodb/blocks";
import type { RegisteredAppSummary } from "../../../lib/gateway-client.js";

export interface AppTabsProps {
  apps: RegisteredAppSummary[];
  value: string | null;
  onValueChange: (slug: string) => void;
}

/**
 * Dumb/presentational only — the connected-apps picker as a simple blocks
 * tab strip. Replaces the card grid: one trigger per app, slug as value.
 */
export function AppTabs({ apps, value, onValueChange }: AppTabsProps) {
  if (apps.length === 0) return <p className="text-[13px] text-ink-muted">No apps registered yet.</p>;

  return (
    <Tabs value={value ?? undefined} onValueChange={onValueChange}>
      <TabsList variant="button" size="md">
        {apps.map((app) => (
          <TabsTrigger key={app.slug} value={app.slug}>
            {app.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
