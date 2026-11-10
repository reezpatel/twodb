import { Button, Card, CardDescription, CardFooter, CardHeader, CardTitle, Chip } from "@twodb/blocks";
import type { AppStatus, RegisteredAppSummary } from "../../../lib/gateway-client.js";

export interface AppCardProps {
  app: RegisteredAppSummary;
  status: AppStatus | null;
  busy: boolean;
  onAction: (action: "install" | "start" | "stop" | "restart" | "upgrade") => void;
  onRemove: () => void;
}

function statusTone(app: RegisteredAppSummary, status: AppStatus | null): "success" | "warning" | "danger" {
  if (app.managed && app.status === "active" && status?.containerStatus !== "stopped") return "success";
  if (app.installStatus === "failed" || status?.containerStatus === "failed") return "danger";
  return "warning";
}

/** First letter as a mark, isometric-flavored per slug. */
function AppMark({ name }: { name: string }) {
  return (
    <span className="flex size-11 items-center justify-center rounded-[10px] border border-outline bg-paper font-sans text-base font-bold text-ink">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Dumb/presentational only — one card per app. */
export function AppCard(props: AppCardProps) {
  const { app, status, busy } = props;
  const running = status?.containerStatus === "running";
  const uninstalled = app.installStatus === "not_installed" || app.installStatus === "uninstalled";

  return (
    <Card>
      <CardHeader>
        <div className="mt-1 flex items-center justify-between">
          <AppMark name={app.name} />
          <Chip tone={app.managed ? "info" : "warning"}>{app.managed ? "Managed" : "External"}</Chip>
        </div>
        <CardTitle className="mt-3 text-base">{app.name}</CardTitle>
        <CardDescription className="text-[13px]">
          {app.managed ? (
            <>Container lifecycle owned by the control plane. {app.version && app.version !== "external" ? `v${app.version}` : ""}</>
          ) : (
            <span className="break-all">
              {app.httpUrl || "—"} · routed at <code>{app.basePath}</code>
            </span>
          )}
        </CardDescription>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip tone={statusTone(app, status)}>{app.installStatus}</Chip>
          {app.managed && status ? <Chip tone={running ? "success" : "warning"}>{status.containerStatus}</Chip> : null}
        </div>
      </CardHeader>
      <CardFooter>
        {app.managed ? (
          uninstalled ? (
            <Button size="sm" disabled={busy} onClick={() => props.onAction("install")}>
              {busy ? "Installing…" : "Install"}
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {running ? (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => props.onAction("stop")}>
                  Stop
                </Button>
              ) : (
                <Button size="sm" disabled={busy} onClick={() => props.onAction("start")}>
                  Start
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => props.onAction("restart")}>
                Restart
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => props.onAction("upgrade")}>
                Upgrade
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Remove ${app.slug}? The container and registry row go away; its Postgres schema stays.`)) {
                    props.onRemove();
                  }
                }}
              >
                Remove
              </Button>
            </div>
          )
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm(`Unregister external app "${app.slug}"? The app itself keeps running; only the gateway entry goes away.`)) {
                props.onRemove();
              }
            }}
          >
            Unregister
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
