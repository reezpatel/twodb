import websocket from "@fastify/websocket";
import type { TwodbFastifyInstance } from "@twodb/contracts";
import {
  rootServicePlugin,
  runPluginMigrations,
  typedDb,
} from "@twodb/shared-backend";
import { nodeDb } from "./db";
import { buildMigrations } from "./db/migrations";
import { NodeGateway } from "./gateway/node-gateway";
import type { NodeCtx } from "./lib/ctx";
import { decorateNodeFunctions } from "./lib/decorate";
import { registerRoutes } from "./routes";
import { PLUGIN_ID } from "../shared/constants";
import { nodeManifest } from "../shared/manifest";

export const TwodbNodeServiceManifest = {
  ...nodeManifest,

  permissions: [
    {
      permission: "plugin.twodb.node:nodes.read",
      description: "List and view nodes",
    },
    {
      permission: "plugin.twodb.node:nodes.manage",
      description: "Create, rename and delete nodes; rotate node secrets",
    },
  ],
  roleDefaults: {
    manager: ["plugin.twodb.node:nodes.read", "plugin.twodb.node:nodes.manage"],
    member: ["plugin.twodb.node:nodes.read"],
  },

  plugin: rootServicePlugin("twodb-node-service", async (fastify) => {
    await runPluginMigrations(typedDb(fastify), PLUGIN_ID, buildMigrations());
    // 128 MiB so storage can move file payloads (base64) through the
    // gateway; the default 1 MiB would truncate any real file transfer.
    await fastify.register(websocket, {
      options: { maxPayload: 128 * 1024 * 1024 },
    });
    const db = nodeDb(fastify);
    const gateway = new NodeGateway(db);
    decorateNodeFunctions(fastify, db, gateway);
    const ctx: NodeCtx = { db, gateway };
    return (scope: TwodbFastifyInstance) => registerRoutes(scope, ctx);
  }),
};

export const service = TwodbNodeServiceManifest;

export default TwodbNodeServiceManifest;
