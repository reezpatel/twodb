import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type {} from "@fastify/cookie";
import { newId } from "@twodb/shared-backend";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type { Generated, Kysely } from "kysely";
import type { CreateVaultRequest, CreateWorkspaceRequest, UpdateVaultRequest, UpdateWorkspaceRequest } from "../shared/api";
import type {} from "../shared/fn";
import type {} from "@twodb/auth/shared/fn";
import { workspaceMigrations } from "./db";

const WORKSPACE_COOKIE = "twodb_workspace";
const WORKSPACE_HEADER = "x-workspace-id";

type VaultRow = { id: string; name: string; created_at: Generated<Date> };
type WorkspaceRow = { id: string; vault_id: string; name: string; created_at: Generated<Date> };

type WorkspaceDb = {
  ws_vaults: VaultRow & { owner_id: string };
  ws_workspaces: WorkspaceRow;
};

const db = (ctx: TwodbContext) => ctx.db as unknown as Kysely<WorkspaceDb>;

let dbRef: Kysely<WorkspaceDb> | null = null;

const requireDbRef = (): Kysely<WorkspaceDb> => {
  if (!dbRef) throw new Error("workspace plugin not initialized");
  return dbRef;
};

const owned = async (ctx: TwodbContext, userId: string, vaultId: string): Promise<boolean> => {
  const row = await db(ctx).selectFrom("ws_vaults").select("id").where("id", "=", vaultId).where("owner_id", "=", userId).executeTakeFirst();
  return row !== undefined;
};

async function vaultContext(ctx: TwodbContext, userId: string) {
  const vaults = await db(ctx).selectFrom("ws_vaults").selectAll().where("owner_id", "=", userId).orderBy("created_at").execute();

  const workspaces = vaults.length
    ? await db(ctx)
        .selectFrom("ws_workspaces")
        .selectAll()
        .where(
          "vault_id",
          "in",
          vaults.map((vault) => vault.id),
        )
        .orderBy("created_at")
        .execute()
    : [];

  return vaults.map((vault) => ({
    id: vault.id,
    name: vault.name,
    created_at: vault.created_at.toISOString(),
    workspaces: workspaces
      .filter((workspace) => workspace.vault_id === vault.id)
      .map((workspace) => ({
        id: workspace.id,
        vault_id: workspace.vault_id,
        name: workspace.name,
        created_at: workspace.created_at.toISOString(),
      })),
  }));
}

const requireUser = async (request: FastifyRequest, reply: FastifyReply): Promise<string | null> => {
  if (!request.userId) {
    reply.code(401).send({ error: "auth_required" });
    return null;
  }
  return request.userId;
};

const cleanName = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return name.length > 0 && name.length <= 80 ? name : null;
};

const WorkspaceServicePlugin = {
  setup: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.decorateRequest("workspaceId", null);
    app.addHook("onRequest", async (request) => {
      const cookie = request.cookies?.[WORKSPACE_COOKIE];
      if (cookie) {
        request.workspaceId = cookie;
        return;
      }
      const header = request.headers[WORKSPACE_HEADER];
      request.workspaceId = typeof header === "string" ? header : Array.isArray(header) && typeof header[0] === "string" ? header[0] : null;
    });
  },
  init: async (ctx: TwodbContext, app: FastifyInstance) => {
    dbRef = db(ctx);
    app.post("/active", async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return reply;
      const workspaceId = (request.body as { workspaceId?: unknown } | undefined)?.workspaceId;
      if (typeof workspaceId !== "string" || !workspaceId) {
        return reply.code(400).send({ error: "invalid_workspace_id" });
      }

      const workspace = await db(ctx)
        .selectFrom("ws_workspaces")
        .innerJoin("ws_vaults", "ws_vaults.id", "ws_workspaces.vault_id")
        .select("ws_workspaces.id")
        .where("ws_workspaces.id", "=", workspaceId)
        .where("ws_vaults.owner_id", "=", user)
        .executeTakeFirst();
      if (!workspace) return reply.code(404).send({ error: "workspace_not_found" });

      reply.setCookie("twodb_workspace", workspaceId, { path: "/", httpOnly: true, sameSite: "lax" });
      return { ok: true };
    });

    app.delete("/active", async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return reply;
      reply.clearCookie("twodb_workspace", { path: "/" });
      return { ok: true };
    });

    app.get("/context", async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return reply;
      return { vaults: await vaultContext(ctx, user) };
    });

    app.post("/vaults", async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return reply;
      const name = cleanName((request.body as Partial<CreateVaultRequest> | undefined)?.name);
      if (!name) return reply.code(400).send({ error: "invalid_name" });

      const vault = await db(ctx)
        .insertInto("ws_vaults")
        .values({ id: newId("vlt"), owner_id: user, name })
        .returningAll()
        .executeTakeFirstOrThrow();
      return { id: vault.id, name: vault.name, created_at: vault.created_at.toISOString(), workspaces: [] };
    });

    app.patch<{ Params: { id: string } }>("/vaults/:id", async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return reply;
      const name = cleanName((request.body as Partial<UpdateVaultRequest> | undefined)?.name);
      if (!name) return reply.code(400).send({ error: "invalid_name" });
      if (!(await owned(ctx, user, request.params.id))) return reply.code(404).send({ error: "vault_not_found" });

      await db(ctx).updateTable("ws_vaults").set({ name }).where("id", "=", request.params.id).execute();
      return { ok: true };
    });

    app.delete<{ Params: { id: string } }>("/vaults/:id", async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return reply;
      if (!(await owned(ctx, user, request.params.id))) return reply.code(404).send({ error: "vault_not_found" });

      await db(ctx).deleteFrom("ws_workspaces").where("vault_id", "=", request.params.id).execute();
      await db(ctx).deleteFrom("ws_vaults").where("id", "=", request.params.id).execute();
      return { ok: true };
    });

    app.post<{ Params: { id: string } }>("/vaults/:id/workspaces", async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return reply;
      const name = cleanName((request.body as Partial<CreateWorkspaceRequest> | undefined)?.name);
      if (!name) return reply.code(400).send({ error: "invalid_name" });
      if (!(await owned(ctx, user, request.params.id))) return reply.code(404).send({ error: "vault_not_found" });

      const workspace = await db(ctx)
        .insertInto("ws_workspaces")
        .values({ id: newId("wsp"), vault_id: request.params.id, name })
        .returningAll()
        .executeTakeFirstOrThrow();
      return {
        id: workspace.id,
        vault_id: workspace.vault_id,
        name: workspace.name,
        created_at: workspace.created_at.toISOString(),
      };
    });

    app.patch<{ Params: { id: string } }>("/workspaces/:id", async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return reply;
      const name = cleanName((request.body as Partial<UpdateWorkspaceRequest> | undefined)?.name);
      if (!name) return reply.code(400).send({ error: "invalid_name" });

      const workspace = await db(ctx)
        .selectFrom("ws_workspaces")
        .innerJoin("ws_vaults", "ws_vaults.id", "ws_workspaces.vault_id")
        .select("ws_workspaces.id")
        .where("ws_workspaces.id", "=", request.params.id)
        .where("ws_vaults.owner_id", "=", user)
        .executeTakeFirst();
      if (!workspace) return reply.code(404).send({ error: "workspace_not_found" });

      await db(ctx).updateTable("ws_workspaces").set({ name }).where("id", "=", request.params.id).execute();
      return { ok: true };
    });

    app.delete<{ Params: { id: string } }>("/workspaces/:id", async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return reply;

      const workspace = await db(ctx)
        .selectFrom("ws_workspaces")
        .innerJoin("ws_vaults", "ws_vaults.id", "ws_workspaces.vault_id")
        .select("ws_workspaces.id")
        .where("ws_workspaces.id", "=", request.params.id)
        .where("ws_vaults.owner_id", "=", user)
        .executeTakeFirst();
      if (!workspace) return reply.code(404).send({ error: "workspace_not_found" });

      await db(ctx).deleteFrom("ws_workspaces").where("id", "=", request.params.id).execute();
      return { ok: true };
    });
  },
  functions: {
    "workspace.owns": async (input: { workspaceId: string; userId: string }) => {
      const row = await requireDbRef()
        .selectFrom("ws_workspaces")
        .innerJoin("ws_vaults", "ws_vaults.id", "ws_workspaces.vault_id")
        .select("ws_workspaces.id")
        .where("ws_workspaces.id", "=", input.workspaceId)
        .where("ws_vaults.owner_id", "=", input.userId)
        .executeTakeFirst();
      return row !== undefined;
    },
  },
  migrations: workspaceMigrations,
} satisfies ServicePlugin;

export default WorkspaceServicePlugin;
