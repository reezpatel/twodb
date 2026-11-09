import type { Context, Hono } from "hono";
import type { WSContext } from "hono/ws";
import type { createNodeWebSocket } from "@hono/node-ws";
import { auth, db } from "../auth";
import { liveAttach, liveDetach, liveInput } from "../lib/teams/manager";
import type { TeamsLiveInput } from "@twodb/runner-core";

type UpgradeWebSocket = ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"];

/**
 * Teams live view: desktop clients attach to a runner-side Chromium screen
 * (screencast frames down, mouse/keyboard input up) so they can complete
 * interactive sign-in / 2FA. Relayed over the runner's control socket.
 */
export function registerTeamsWs(app: Hono, upgradeWebSocket: UpgradeWebSocket) {
  app.get(
    "/api/teams/live",
    upgradeWebSocket((c: Context) => {
      const accountId = c.req.query("accountId") ?? "";
      const sessionReady = auth.api
        .getSession({ headers: c.req.raw.headers })
        .then((s) => (s?.session.activeOrganizationId ? { organizationId: s.session.activeOrganizationId } : null))
        .catch(() => null);
      let viewId: string | null = null;

      return {
        async onOpen(_evt: unknown, ws: WSContext) {
          const session = await sessionReady;
          if (!session) {
            ws.close(4401, "unauthorized");
            return;
          }
          const account = await db
            .selectFrom("teams_account")
            .selectAll()
            .where("id", "=", accountId)
            .where("organizationId", "=", session.organizationId)
            .executeTakeFirst();
          if (!account) {
            ws.close(4404, "account not found");
            return;
          }
          viewId = liveAttach(account, ws);
          if (!viewId) {
            ws.send(JSON.stringify({ type: "error", message: "runner offline or screen already in use" }));
            ws.close(4409, "unavailable");
            return;
          }
          ws.send(JSON.stringify({ type: "attached", accountId }));
        },

        onMessage(evt: { data: unknown }) {
          if (!viewId) return;
          let msg: { type?: string; input?: TeamsLiveInput };
          try {
            msg = JSON.parse(String(evt.data));
          } catch {
            return;
          }
          if (msg.type === "input" && msg.input) liveInput(viewId, msg.input);
        },

        onClose() {
          if (viewId) liveDetach(viewId);
        },
      };
    }),
  );
}
