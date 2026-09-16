import type { Kysely } from "kysely";
import type { NodeDB } from "../db/schema";
import type { NodeGateway } from "../gateway/node-gateway";

export interface NodeCtx {
	db: Kysely<NodeDB>;
	gateway: NodeGateway;
}
