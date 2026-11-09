import { db } from "../auth";
import { abortSessionRun } from "../routes/code-ws";
import { retireSessionJobs } from "./background-jobs";
import { logger } from "./logger";

/**
 * /new and /compact begin a fresh context, so work spawned by the old one is
 * stopped and removed from the sidebar: background jobs are killed and hidden,
 * subagent sessions (and their own children) are aborted and archived.
 * Nothing is deleted — rows stay in the database.
 */
export async function retireSessionWork(sessionId: string): Promise<void> {
  try {
    await retireSessionJobs(sessionId);

    // Walk the subagent tree breadth-first.
    let frontier = [sessionId];
    const archived: string[] = [];
    while (frontier.length > 0) {
      const children = await db
        .selectFrom("code_session")
        .select("id")
        .where("parentSessionId", "in", frontier)
        .where("type", "=", "sub_agent")
        .where("archivedAt", "is", null)
        .execute();
      frontier = children.map((c) => c.id);
      archived.push(...frontier);
    }
    if (archived.length === 0) return;
    for (const id of archived) abortSessionRun(id);
    await db.updateTable("code_session").set({ archivedAt: new Date() }).where("id", "in", archived).execute();
    await Promise.all(archived.map((id) => retireSessionJobs(id)));
  } catch (err) {
    // Never fail the clear/compact itself over cleanup.
    logger.warn({ err, sessionId }, "retire session work failed");
  }
}
