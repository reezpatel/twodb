import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import { codeMigrations, type CodeTables } from "./db";
import { registerSessionRoutes } from "./routes";
import { registerSessionSocket } from "./ws";

let invokeRef: <T>(name: string, ...args: unknown[]) => Promise<T> = () => {
  throw new Error("code plugin not initialized");
};

const CodeServicePlugin = {
  init: async (ctx: TwodbContext, app: FastifyInstance) => {
    invokeRef = app.invoke.bind(app) as <T>(name: string, ...args: unknown[]) => Promise<T>;
    const kysely = ctx.db as unknown as Kysely<CodeTables>;
    await app.register(async (scope) => {
      await registerSessionRoutes(kysely, invokeRef, scope);
      await registerSessionSocket(kysely, invokeRef, scope);
    });
  },

  migrations: codeMigrations,
} satisfies ServicePlugin;

export default CodeServicePlugin;
