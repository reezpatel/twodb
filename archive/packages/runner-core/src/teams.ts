/**
 * Teams bridge protocol — shared by the server (orchestrator) and the runner
 * (Chromium host). One watched Teams account = one persistent browser
 * profile on its runner; events flow runner→server, control flows
 * server→runner, and the live view (2FA / reconnect) is a JPEG screencast
 * relayed through the server to the desktop client.
 */

export interface TeamsAccountConfig {
  id: string;
  label: string;
  /** Login hint shown on the connect screen (UPN/email). */
  email?: string | null;
  /** Poll cadence override (ms); runner default applies when unset. */
  pollIntervalMs?: number;
}

/** idle | starting | running | auth_required | error | runner_offline */
export type TeamsAccountStatus = "idle" | "starting" | "running" | "auth_required" | "error" | "runner_offline";

export interface TeamsEvent {
  kind: "message" | "mention" | "call";
  /** Stable per-source id — the server dedupes on (accountId, id). */
  id: string;
  chatName?: string | null;
  sender?: string | null;
  text?: string | null;
  ts?: string | null;
  /** Calls only: incoming (ringing) → missed | ended. */
  callState?: "incoming" | "missed" | "ended";
  /** Deep link into Teams web for the open action. */
  url?: string | null;
}

/** Desktop → runner input over the live view. */
export interface TeamsLiveInput {
  kind: "click" | "type" | "key" | "scroll";
  /** Viewport CSS pixels. */
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  deltaY?: number;
}
