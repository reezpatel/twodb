import { ArrowUpRight, Check } from "lucide-react";
import { Button, Card, CardDescription, CardFooter, CardHeader, CardTitle, Chip } from "@twodb/blocks";
import type { RegisteredAppSummary } from "../../../lib/gateway-client.js";

export interface ExplorerAppCardProps {
  app: RegisteredAppSummary;
  selected: boolean;
  onExplore: () => void;
}

/** First letter as a mark, isometric-flavored per slug (same as registry's AppMark). */
function AppMark({ name }: { name: string }) {
  return (
    <span className="flex size-11 items-center justify-center rounded-[10px] border border-outline bg-paper font-sans text-base font-bold text-ink">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Dumb/presentational only — one connect-style card per registered app. */
export function ExplorerAppCard({ app, selected, onExplore }: ExplorerAppCardProps) {
  return (
    <Card className={selected ? "border-ink" : undefined}>
      <CardHeader>
        <div className="mt-1 flex items-center justify-between">
          <AppMark name={app.name} />
          <div className="flex flex-wrap justify-end gap-1.5">
            <Chip tone={app.status === "active" ? "success" : "warning"}>{app.status}</Chip>
            <Chip tone={app.managed ? "info" : "warning"}>{app.managed ? "Managed" : "External"}</Chip>
          </div>
        </div>
        <CardTitle className="mt-3 text-base">{app.name}</CardTitle>
        <CardDescription className="text-[13px]">
          {app.capabilities.length ? app.capabilities.join(" · ") : app.basePath}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="ghost" size="sm" className="px-0" disabled={selected} onClick={onExplore}>
          {selected ? (
            <>
              Selected
              <Check className="size-4" aria-hidden="true" />
            </>
          ) : (
            <>
              Explore API
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
