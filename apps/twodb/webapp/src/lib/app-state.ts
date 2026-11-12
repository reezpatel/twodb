import type { RegisteredAppSummary } from "./gateway-client.js";

export type StateTone = "success" | "warning" | "danger" | "muted";

export interface AppState {
  label: string;
  tone: StateTone;
  /** Only for in-flight work — motion that conveys state. */
  pulse?: boolean;
}

/** Not on this host yet (never installed, or removed) — offered under "Available". */
export function isAvailable(app: RegisteredAppSummary): boolean {
  return app.installStatus === "not_installed" || app.installStatus === "uninstalled";
}

/**
 * One human state per app, from what the control plane knows:
 * lifecycle first (installing/failed/stopped), then liveness from the heartbeat.
 */
export function appState(app: RegisteredAppSummary): AppState {
  if (isAvailable(app)) return { label: "Not installed", tone: "muted" };
  switch (app.installStatus) {
    case "installing":
      return { label: "Installing…", tone: "warning", pulse: true };
    case "failed":
      return { label: "Failed", tone: "danger" };
    case "stopped":
      return { label: "Stopped", tone: "muted" };
  }
  switch (app.status) {
    case "active":
      return { label: "Active", tone: "success" };
    case "inactive":
      return { label: "No heartbeat", tone: "warning" };
    case "external":
      return { label: "Not monitored", tone: "muted" };
    default:
      return { label: "Waiting…", tone: "muted" };
  }
}
