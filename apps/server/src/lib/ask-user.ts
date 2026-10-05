// ask_user bridge: the agent loop blocks on a promise that a WS message from
// any viewer of the session resolves. Keyed by session — one open question per
// session at a time (the loop serializes tool calls).

export interface AskUserQuestion {
  question: string;
  options?: string[];
  allowMultiple?: boolean;
}

/** string for single choice or custom text; string[] for multi-select. */
export type AskUserAnswer = string | string[];

export interface AskUserResolution {
  cancelled: boolean;
  answers?: AskUserAnswer[];
}

interface PendingEntry {
  callId: string;
  resolve: (r: AskUserResolution) => void;
}

const pending = new Map<string, PendingEntry>();

/** Resolves when the user submits answers (or immediately as cancelled when they stop). */
export function waitForAskUserResponse(sessionId: string, callId: string): Promise<AskUserResolution> {
  return new Promise((resolve) => {
    pending.set(sessionId, { callId, resolve });
  });
}

/** WS ask_user_response → resolves the pending question. False when unknown/stale. */
export function resolveAskUser(sessionId: string, callId: string, resolution: AskUserResolution): boolean {
  const entry = pending.get(sessionId);
  if (!entry || entry.callId !== callId) return false;
  pending.delete(sessionId);
  entry.resolve(resolution);
  return true;
}

/** Drop a pending question without resolving (run aborted while waiting). */
export function clearAskUser(sessionId: string): void {
  pending.delete(sessionId);
}
