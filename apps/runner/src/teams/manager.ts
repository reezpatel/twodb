import os from "node:os";
import path from "node:path";
import type { ServerMessage, TeamsLiveInput } from "@twodb/runner-core";
import { TeamsReader } from "./reader";

/**
 * Owns every Teams account watched by this runner. Control messages arrive
 * from the server over the runner socket (teamsStart/teamsStop/teamsLive*);
 * reader output (status, events, screencast frames) flows back the same way.
 */

const PROFILE_ROOT = process.env.TWODB_TEAMS_PROFILE_ROOT ?? path.join(os.homedir(), ".twodb", "teams");

export class TeamsManager {
  private readers = new Map<string, TeamsReader>();

  constructor(private send: (msg: unknown) => void) {}

  async handle(msg: ServerMessage) {
    switch (msg.type) {
      case "teamsStart": {
        if (!msg.teamsAccount) return;
        const existing = this.readers.get(msg.teamsAccount.id);
        if (existing) await existing.stop().catch(() => {});
        const reader = new TeamsReader(msg.teamsAccount, path.join(PROFILE_ROOT, msg.teamsAccount.id), (m) => this.send(m));
        this.readers.set(msg.teamsAccount.id, reader);
        void reader.start();
        break;
      }
      case "teamsStop": {
        const reader = this.readers.get(msg.teamsAccountId ?? "");
        this.readers.delete(msg.teamsAccountId ?? "");
        await reader?.stop().catch(() => {});
        break;
      }
      case "teamsLiveStart":
        await this.readers.get(msg.teamsAccountId ?? "")?.liveStart(msg.viewId ?? "").catch(() => {});
        break;
      case "teamsLiveStop":
        await this.readers.get(msg.teamsAccountId ?? "")?.liveStop(msg.viewId ?? "").catch(() => {});
        break;
      case "teamsLiveInput":
        if (msg.input) await this.readers.get(msg.teamsAccountId ?? "")?.liveInput(msg.input as TeamsLiveInput).catch(() => {});
        break;
    }
  }

  async stopAll() {
    for (const reader of this.readers.values()) await reader.stop().catch(() => {});
    this.readers.clear();
  }
}
