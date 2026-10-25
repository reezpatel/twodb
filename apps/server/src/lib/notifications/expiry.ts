import { sql } from "kysely";
import { db } from "../../auth";
import { logger } from "../logger";

// Expiry sweep: expired rows leave the live feed immediately via the
// expiresAt filter in every query; this job reclaims storage on a cadence.
// Hard cap: expired rows are purged 7 days after expiry, archived (dismissed)
// rows 30 days after dismissal — earlier than the blanket 30-day expiry only
// when the producer set a shorter TTL.

const SWEEP_MS = 10 * 60_000;

let timer: ReturnType<typeof setInterval> | null = null;

export async function sweepExpired() {
  const purged = await sql<{ n: number }>`
    with deleted as (
      delete from "notification"
       where "expiresAt" < now() - interval '7 days'
          or ("id" in (select "notificationId" from "notification_recipient" where "dismissedAt" < now() - interval '30 days'))
      returning 1
    ) select count(*)::int as n from deleted`.execute(db);
  logger.debug({ purged: purged.rows[0]?.n ?? 0 }, "notification sweep");
}

export function startNotificationSweeper() {
  if (timer) return;
  timer = setInterval(() => void sweepExpired().catch((err) => logger.warn({ err }, "notification sweep failed")), SWEEP_MS);
  timer.unref?.();
}

export function stopNotificationSweeper() {
  if (timer) clearInterval(timer);
  timer = null;
}
