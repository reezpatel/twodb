import { Hono } from "hono";
import { auth } from "../auth";
import { getServerSettings, setServerSetting } from "../lib/server-settings";

// Server-admin only: instance-wide settings.

export const serverSettingsRoutes = new Hono()
  .use("*", async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session || session.user.role !== "admin") {
      return c.json({ error: "forbidden" }, 403);
    }
    await next();
  })

  .get("/", async (c) => c.json(await getServerSettings()))

  .put("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") return c.json({ error: "invalid_body" }, 400);

    if (body.signUpEnabled !== undefined) {
      if (typeof body.signUpEnabled !== "boolean") return c.json({ error: "invalid_sign_up_enabled" }, 400);
      await setServerSetting("signUpEnabled", body.signUpEnabled);
    }
    if (body.signUpEnabled === undefined) return c.json({ error: "empty_update" }, 400);

    return c.json(await getServerSettings());
  });
