import type { Context } from "hono";
import { db } from "../auth";
import { getNode, type NoteNode } from "./notes-nodes";
import { getRowProps } from "./notes-tables";

export class RowHookError extends Error {
  constructor(
    public code: string,
    public status: 400 | 403 | 404 | 409 = 400,
    public detail?: string,
  ) {
    super(code);
  }
}

export interface RowActor {
  id: string | null;
  name: string | null;
}

export interface HookContext {
  organizationId: string;
  database: NoteNode;
  actor: RowActor;
}

export interface RowSnapshot {
  noteId: string;
  title: string;
  props: Record<string, unknown>;
}

export interface RowDraft {
  title: string;
  props: Record<string, unknown>;
}

export interface RowPatch {
  title?: string;
  props: Record<string, unknown>;
}

/** App-feature rules for rows of a locked database. The generic row routes
 *  (notes-content + notes nodes) call these so edits made from the Notes app
 *  obey the same rules as the feature's own endpoints. */
export interface LockedDatabaseHooks {
  /** Rows are written only by the feature itself — generic routes reject. */
  rowsReadOnly?: boolean;
  beforeInsert?(ctx: HookContext, draft: RowDraft): Promise<Partial<RowDraft> | undefined>;
  afterInsert?(ctx: HookContext, row: RowSnapshot): Promise<void>;
  /** Receives the changed fields only; may return extra fields to write. */
  beforeUpdate?(ctx: HookContext, prev: RowSnapshot, patch: RowPatch): Promise<Partial<RowPatch> | undefined>;
  afterUpdate?(ctx: HookContext, prev: RowSnapshot, next: RowSnapshot): Promise<void>;
  beforeDelete?(ctx: HookContext, row: RowSnapshot): Promise<void>;
  afterDelete?(ctx: HookContext, row: RowSnapshot): Promise<void>;
  afterRestore?(ctx: HookContext, row: RowSnapshot): Promise<void>;
}

const registry = new Map<string, LockedDatabaseHooks>();

export function registerLockedDatabase(lockId: string, hooks: LockedDatabaseHooks) {
  registry.set(lockId, hooks);
}

export function hooksFor(database: Pick<NoteNode, "schemaLockedBy">): LockedDatabaseHooks | null {
  return database.schemaLockedBy ? (registry.get(database.schemaLockedBy) ?? null) : null;
}

export function actorOf(s: { session: { user: { id: string; name?: string | null; email?: string | null } } | null }): RowActor {
  const user = s.session?.user;
  return { id: user?.id ?? null, name: user ? user.name || user.email || null : null };
}

/** The locked database a row page belongs to, when its feature registered hooks. */
export async function lockedParentOf(organizationId: string, node: NoteNode): Promise<NoteNode | null> {
  if (node.kind !== "page" || !node.parentId) return null;
  const parent = await getNode(organizationId, node.parentId, { includeDeleted: true });
  return parent && parent.kind === "database" && hooksFor(parent) ? parent : null;
}

/** Turns a hook rejection into the JSON error response; rethrows anything else. */
export function hookErrorResponse(c: Context, e: unknown) {
  if (e instanceof RowHookError) return c.json({ error: e.code, ...(e.detail ? { detail: e.detail } : {}) }, e.status);
  throw e;
}

export function readOnlyResponse(c: Context, database: NoteNode) {
  return c.json({ error: "rows_read_only", lockedBy: database.schemaLockedBy }, 403);
}

export async function runBeforeInsert(ctx: HookContext, draft: RowDraft): Promise<RowDraft> {
  const out = await hooksFor(ctx.database)?.beforeInsert?.(ctx, draft);
  return { title: out?.title ?? draft.title, props: { ...draft.props, ...out?.props } };
}

export async function runBeforeUpdate(ctx: HookContext, prev: RowSnapshot, patch: RowPatch): Promise<RowPatch> {
  const out = await hooksFor(ctx.database)?.beforeUpdate?.(ctx, prev, patch);
  const title = out?.title ?? patch.title;
  return { ...(title !== undefined ? { title } : {}), props: { ...patch.props, ...out?.props } };
}

export async function snapshotRow(databaseId: string, noteId: string): Promise<RowSnapshot | null> {
  const node = await db.selectFrom("note_node").select(["id", "title"]).where("id", "=", noteId).executeTakeFirst();
  if (!node) return null;
  return { noteId, title: node.title, props: await getRowProps(db, databaseId, noteId) };
}
