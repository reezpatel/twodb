import { sql } from "kysely";
import { db } from "../../auth";

// Contacts are learned, never synced: every email and calendar interaction
// upserts the people involved into the account's book. Score is a
// recency-weighted sum stored relative to a fixed epoch (w · 2^(days/90)),
// so ranking by it equals ranking by decayed score without any decay job.

const EPOCH_MS = Date.UTC(2024, 0, 1);
const HALF_LIFE_DAYS = 90;
const DAY_MS = 86_400_000;
const NOREPLY_RE = /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer[-_.]daemon|postmaster|bounces?|notifications?|alerts?)([+-][^@]*)?@/i;
const BIG_MEETING = 25;

export type Interaction = "sent" | "replied" | "received" | "cc_received" | "meeting" | "organized_by_me" | "organized_by_them" | "declined" | "manual";

const WEIGHT: Record<Interaction, number> = {
  sent: 3,
  replied: 2,
  received: 0.3,
  cc_received: 0.1,
  meeting: 1,
  organized_by_me: 3,
  organized_by_them: 2,
  declined: 0.3,
  manual: 1,
};

export interface LearnPerson {
  email: string;
  name?: string | null;
}

export interface LearnInput {
  organizationId: string;
  bookId: string;
  people: LearnPerson[];
  interaction: Interaction;
  at: Date;
  source: "email" | "calendar" | "imip" | "manual";
  /** Addresses of the account owner (+ aliases) — never learned. */
  self: Set<string>;
  /** Bulk/list mail: store as kind=list (hidden from suggestions). */
  kind?: "person" | "list" | "resource";
  /** Meeting size, used to damp large meetings. */
  groupSize?: number;
  /** Upcoming meeting start, for the People list. */
  meetingAt?: Date | null;
}

export function scoreDelta(weight: number, at: Date): number {
  return weight * 2 ** ((at.getTime() - EPOCH_MS) / DAY_MS / HALF_LIFE_DAYS);
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const email = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^mailto:/, "");
  return /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(email) ? email : null;
}

export function isNoReply(email: string): boolean {
  return NOREPLY_RE.test(email);
}

/** Upserts people into one book; forgotten contacts are never re-learned. */
export async function learnContacts(input: LearnInput): Promise<void> {
  const seen = new Map<string, string | null>();
  for (const p of input.people) {
    const email = normalizeEmail(p.email);
    if (!email || input.self.has(email) || seen.has(email)) continue;
    if (isNoReply(email) && input.interaction !== "manual") continue;
    const name = p.name?.trim().replace(/^["']|["']$/g, "") || null;
    seen.set(email, name && name.toLowerCase() !== email ? name : null);
  }
  if (!seen.size) return;

  const kind = input.kind ?? "person";
  let weight = kind === "list" ? 0 : WEIGHT[input.interaction];
  if ((input.groupSize ?? 0) > BIG_MEETING) weight *= 0.3;
  const delta = scoreDelta(weight, input.at);
  const now = new Date();
  const isEmail = input.source === "email";
  const isMeeting = input.source === "calendar" || input.source === "imip";
  const future = input.meetingAt && input.meetingAt > now ? input.meetingAt : null;
  const past = input.meetingAt && input.meetingAt <= now ? input.meetingAt : isMeeting ? input.at : null;

  const rows = [...seen].map(([email, name]) => ({
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    bookId: input.bookId,
    email,
    name,
    nameSource: name ? input.source : "email",
    kind,
    sentCount: input.interaction === "sent" ? 1 : 0,
    receivedCount: input.interaction === "received" || input.interaction === "cc_received" ? 1 : 0,
    repliedCount: input.interaction === "replied" ? 1 : 0,
    meetingCount: isMeeting && input.interaction !== "declined" ? 1 : 0,
    organizedByMeCount: input.interaction === "organized_by_me" ? 1 : 0,
    organizedByThemCount: input.interaction === "organized_by_them" ? 1 : 0,
    score: delta,
    firstSeenAt: input.at,
    lastSeenAt: input.at,
    lastEmailAt: isEmail ? input.at : null,
    lastMeetingAt: past,
    nextMeetingAt: future,
    notes: null,
    userId: null,
    forgottenAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));

  await db
    .insertInto("contact")
    .values(rows)
    .onConflict((oc) =>
      oc
        .columns(["bookId", "email"])
        .doUpdateSet({
          name: sql`case when contact."nameSource" <> 'manual' and excluded.name is not null then excluded.name else contact.name end`,
          nameSource: sql`case when contact."nameSource" <> 'manual' and excluded.name is not null then excluded."nameSource" else contact."nameSource" end`,
          kind: sql`case when contact.kind = 'list' and excluded.kind = 'person' and excluded."sentCount" > 0 then 'person' else contact.kind end`,
          sentCount: sql`contact."sentCount" + excluded."sentCount"`,
          receivedCount: sql`contact."receivedCount" + excluded."receivedCount"`,
          repliedCount: sql`contact."repliedCount" + excluded."repliedCount"`,
          meetingCount: sql`contact."meetingCount" + excluded."meetingCount"`,
          organizedByMeCount: sql`contact."organizedByMeCount" + excluded."organizedByMeCount"`,
          organizedByThemCount: sql`contact."organizedByThemCount" + excluded."organizedByThemCount"`,
          score: sql`contact.score + excluded.score`,
          firstSeenAt: sql`least(contact."firstSeenAt", excluded."firstSeenAt")`,
          lastSeenAt: sql`greatest(contact."lastSeenAt", excluded."lastSeenAt")`,
          lastEmailAt: sql`greatest(contact."lastEmailAt", excluded."lastEmailAt")`,
          lastMeetingAt: sql`greatest(contact."lastMeetingAt", excluded."lastMeetingAt")`,
          nextMeetingAt: sql`case when excluded."nextMeetingAt" is null then contact."nextMeetingAt" when contact."nextMeetingAt" is null or contact."nextMeetingAt" < now() then excluded."nextMeetingAt" else least(contact."nextMeetingAt", excluded."nextMeetingAt") end`,
          deletedAt: null,
          updatedAt: now,
        })
        .where(sql<boolean>`contact."forgottenAt" is null`),
    )
    .execute();
}

/** Bulk-mail signals from the headers we keep at parse time. */
export function isBulkMail(headers: Record<string, string>): boolean {
  return !!(
    headers["list-id"] ||
    headers["list-unsubscribe"] ||
    /bulk|list|junk/i.test(headers.precedence ?? "") ||
    /auto-/i.test(headers["auto-submitted"] ?? "")
  );
}
