import { Button, Chip } from "@twodb/blocks";
import type { RegisteredAppSummary, AppStatus } from "../../../lib/gateway-client.js";

export interface AppRowProps {
  app: RegisteredAppSummary;
  status: AppStatus | null;
  busy: boolean;
  onAction: (action: "install" | "start" | "stop" | "restart" | "upgrade") => void;
  onRemove: () => void;
}

function statusTone(app: RegisteredAppSummary, status: AppStatus | null): "success" | "warning" | "danger" {
  if (app.status === "active" && status?.containerStatus !== "stopped") return "success";
  if (app.installStatus === "failed" || status?.containerStatus === "failed") return "danger";
  return "warning";
}

/** Dumb/presentational only. */
export function AppRow(props: AppRowProps) {
  const { app, status, busy } = props;
  const installStatus = app.installStatus;
  const running = status?.containerStatus === "running";

  return (
    <tr>
      <td>{app.name}</td>
      <td>
        <code>{app.slug}</code>
      </td>
      <td>{app.version ? `v${app.version}` : "—"}</td>
      <td>
        <Chip tone={statusTone(app, status)}>{installStatus}</Chip>{" "}
        <Chip tone={app.status === "active" ? "success" : "warning"}>{app.status}</Chip>{" "}
        {status ? <Chip tone={running ? "success" : "warning"}>{status.containerStatus}</Chip> : null}
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        {installStatus === "not_installed" || installStatus === "uninstalled" ? (
          <Button size="sm" disabled={busy} onClick={() => props.onAction("install")}>
            {busy ? "Installing…" : "Install"}
          </Button>
        ) : (
          <>
            {running ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => props.onAction("stop")}>
                Stop
              </Button>
            ) : (
              <Button size="sm" disabled={busy} onClick={() => props.onAction("start")}>
                Start
              </Button>
            )}{" "}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => props.onAction("restart")}>
              Restart
            </Button>{" "}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => props.onAction("upgrade")}>
              Upgrade
            </Button>{" "}
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
          </>
        )}
      </td>
    </tr>
  );
}
