import { Link } from "react-router";
import { Button, cn } from "@twodb/blocks";
import { formatAppName } from "../../../lib/app-name.js";
import { appState, isAvailable } from "../../../lib/app-state.js";
import type { RegisteredAppSummary } from "../../../lib/gateway-client.js";
import { AppMenu, type AppMenuProps } from "./AppMenu.js";
import { AppStateDot } from "./AppStateDot.js";

/** Shared by the header and every row so columns line up. */
export const APP_COLUMNS = "sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_2.25rem]";

export interface AppRowProps extends Omit<AppMenuProps, "app"> {
  app: RegisteredAppSummary;
}

/**
 * Dumb/presentational — one app as a scannable row. Name + route lead; state, mode and version
 * are the supporting columns; one action at the end (Install, or the ⋮ menu). On narrow screens
 * the supporting facts wrap onto a second line under the name.
 *
 * The whole row opens the app's details: the name is a real link whose hit area is stretched over
 * the row (after:inset-0), while the action sits above it (z-10) so it stays independently usable.
 */
export function AppRow({ app, running, busy, onAction, onRotateToken, onRemove }: AppRowProps) {
  const state = appState(app);
  const available = isAvailable(app);
  return (
    <div className={cn("group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-stone/50 has-[a:focus-visible]:bg-stone/50 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-ion-deep", APP_COLUMNS)}>
      <div className="min-w-0">
        <Link
          to={`/app/${app.slug}/endpoints`}
          className="block truncate text-[13px] font-medium text-ink outline-none after:absolute after:inset-0 after:content-['']"
        >
          {formatAppName(app.name)}
        </Link>
        <code className="block truncate font-mono text-[11px] text-ink-muted">{app.basePath}</code>
      </div>

      <div className="relative z-10 justify-self-end sm:col-start-5 sm:row-start-1">
        {available ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction("install")}>
            {busy ? "Installing…" : "Install"}
          </Button>
        ) : (
          <AppMenu app={app} running={running} busy={busy} onAction={onAction} onRotateToken={onRotateToken} onRemove={onRemove} />
        )}
      </div>

      <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-muted sm:contents">
        <span className="sm:block">
          <AppStateDot state={state} />
        </span>
        <span>{available ? "—" : app.managed ? "Managed" : "Unmanaged"}</span>
        <span className="font-mono text-[11px]">{app.version && app.version !== "external" && !available ? `v${app.version}` : "—"}</span>
      </div>
    </div>
  );
}
