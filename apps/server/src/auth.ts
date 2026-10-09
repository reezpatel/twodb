import { APIError, betterAuth } from "better-auth";
import { admin, organization } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { apiKey } from "@better-auth/api-key";
import { createDb } from "./plugins/db";
import { env } from "./env";
import { getServerSettings } from "./lib/server-settings";
import { logger } from "./lib/logger";

export const db = createDb(env.databaseUrl);

function isSignUpRequest(request: Request | undefined): boolean {
  try {
    return !!request?.url && new URL(request.url).pathname.endsWith("/sign-up/email");
  } catch {
    return false;
  }
}

export const auth = betterAuth({
  database: { db, type: "pg" },
  secret: env.auth.secret,
  baseURL: env.auth.url,
  trustedOrigins: [env.webOrigin],
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      logger.info({ email: user.email }, `password reset link: ${url}`);
    },
  },
  hooks: {
    before: async (ctx) => {
      if (isSignUpRequest(ctx.request)) {
        const settings = await getServerSettings();
        if (!settings.signUpEnabled) {
          throw new APIError("FORBIDDEN", { message: "Sign-up is disabled" });
        }
      }
    },
  },
  plugins: [
    admin(),
    organization(),
    passkey({
      rpName: "twodb",
      rpID: env.passkey.rpID,
      origin: [env.webOrigin, env.auth.url],
    }),
    apiKey(),
  ],
});

export type Auth = typeof auth;
