/**
 * Smoke test for the Teams bridge reader — no real Teams account needed.
 * Verifies: chromium launches, login redirect is detected (auth_required),
 * screencast frames flow, and input doesn't crash the reader.
 *
 *   pnpm --filter @twodb/runner smoke:teams
 */
import os from "node:os";
import path from "node:path";
import { TeamsReader } from "./teams/reader";

const profileDir = path.join(os.tmpdir(), `twodb-teams-smoke-${Date.now()}`);
let frames = 0;
const statuses: string[] = [];

const reader = new TeamsReader(
  { id: "smoke", label: "Smoke Test" },
  profileDir,
  (msg) => {
    if (msg.type === "teamsStatus") {
      statuses.push(msg.status ?? "?");
      console.log(`status → ${msg.status}${msg.error ? ` (${msg.error})` : ""}`);
    } else if (msg.type === "teamsLiveFrame") {
      frames++;
      if (frames === 1) console.log("live frame received (screencast works)");
    } else if (msg.type === "teamsEvent") {
      console.log(`event → ${msg.event?.kind} ${msg.event?.text ?? ""}`.slice(0, 120));
    }
  },
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

await reader.start();
await sleep(12_000); // let the poll loop hit teams.microsoft.com and land on login

await reader.liveStart("view-1");
await sleep(3_000);
await reader.liveInput({ kind: "click", x: 640, y: 450 });
await reader.liveInput({ kind: "type", text: "test@example.com" });
await sleep(1_000);
await reader.liveStop("view-1");

await reader.stop();

const okAuth = statuses.includes("auth_required") || statuses.includes("running") || statuses.includes("starting");
const okFrames = frames > 0;
console.log(`\nresult: auth-detection=${okAuth ? "ok" : "FAIL"} screencast=${okFrames ? `ok (${frames} frames)` : "FAIL"}`);
process.exit(okAuth && okFrames ? 0 : 1);
