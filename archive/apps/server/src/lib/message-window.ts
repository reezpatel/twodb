import { db } from "../auth";
import { sql } from "kysely";

export interface CodeMessageRow {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  meta: unknown;
  createdAt: string | Date;
}

export interface MessageCursor {
  createdAt: string;
  id: string;
}

/** (createdAt, id) — createdAt alone has no tiebreaker for same-ms inserts. */
export function messageCursor(m: CodeMessageRow): MessageCursor {
  return { createdAt: new Date(m.createdAt).toISOString(), id: m.id };
}

/**
 * Newest-first keyset window over a session's messages, returned chronologically.
 * before: fetch the page strictly older than the cursor.
 */
export async function fetchSessionMessages(sessionId: string, opts: { limit: number; before?: MessageCursor }): Promise<CodeMessageRow[]> {
  let q = db
    .selectFrom("code_session_message")
    .selectAll()
    .where("sessionId", "=", sessionId);
  if (opts.before) {
    const cursor = messageCursor({ id: opts.before.id, sessionId, role: "user", content: "", meta: null, createdAt: opts.before.createdAt });
    const before = sql`(${cursor.createdAt}, ${cursor.id})`;
    q = q.where((eb) => sql`(${eb.ref("createdAt")}, ${eb.ref("id")}) < ${before}`);
  }
  const rows = await q
    .orderBy("createdAt", "desc")
    .orderBy("id", "desc")
    .limit(opts.limit)
    .execute();
  return rows.reverse() as CodeMessageRow[];
}

/**
 * The chat UI renders an assistant message's tool calls together with the
 * `tool` result rows that follow it. A window that starts mid-run would split
 * them, so extend backwards past any leading tool rows until the window starts
 * on a non-tool row (the assistant holding the calls) or history runs out.
 */
export async function fetchSessionMessageWindow(sessionId: string, limit: number): Promise<CodeMessageRow[]> {
  const rows = await fetchSessionMessages(sessionId, { limit });
  while (rows.length > 0 && rows[0].role === "tool") {
    const meta = rows[0].meta as { toolCallId?: string } | null;
    if (!meta?.toolCallId) break; // orphaned tool row — safe start
    const match = await sql<{ id: string }>`
      select id from code_session_message
      where "sessionId" = ${sessionId}
        and role = 'assistant'
        and meta @> ${JSON.stringify({ toolCalls: [{ id: meta.toolCallId }] })}::jsonb
      limit 1`.execute(db);
    if (match.rows.length === 0) break; // orphaned — nothing above to reunite
    const previous = await fetchSessionMessages(sessionId, { limit: 1, before: messageCursor(rows[0]) });
    if (previous.length === 0) break;
    rows.unshift(...previous);
  }
  return rows;
}
