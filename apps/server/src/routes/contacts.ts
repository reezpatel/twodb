import { Hono, type Context } from "hono";
import { logger } from "../lib/logger";
import { requireOrgSession } from "../lib/session";
import { EmailAccessError } from "../lib/email/access";
import { listBooks } from "../lib/contacts/books";
import { contactActivity, createContact, forgetContact, listContacts, suggestContacts, updateContact, type BookScope } from "../lib/contacts/contacts";

// Contacts are always read through one book: bookId, or an account /
// calendar the server resolves to its book after an access check.

async function user(c: Context) {
  const s = await requireOrgSession(c);
  if (!s?.session) return null;
  return { organizationId: s.organizationId, userId: s.session.user.id };
}

type Handler = (u: NonNullable<Awaited<ReturnType<typeof user>>>, c: Context) => Promise<Response>;

function handle(fn: Handler) {
  return async (c: Context) => {
    const u = await user(c);
    if (!u) return c.json({ error: "unauthorized" }, 401);
    try {
      return await fn(u, c);
    } catch (e) {
      if (e instanceof EmailAccessError) return c.json({ error: e.message }, e.status);
      logger.error({ err: e, path: c.req.path }, "contacts route failed");
      return c.json({ error: "request_failed", detail: (e as Error).message }, 500);
    }
  };
}

function scope(c: Context): BookScope {
  return { bookId: c.req.query("bookId") || null, accountId: c.req.query("accountId") || null, calendarId: c.req.query("calendarId") || null };
}

async function body(c: Context): Promise<Record<string, unknown>> {
  return ((await c.req.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
}

export const contactRoutes = new Hono()
  .get(
    "/books",
    handle(async (u, c) => c.json(await listBooks(u.organizationId, u.userId))),
  )
  .get(
    "/suggest",
    handle(async (u, c) => {
      const exclude = (c.req.query("exclude") ?? "").split(",").filter(Boolean);
      return c.json(
        await suggestContacts(u.organizationId, u.userId, scope(c), c.req.query("q") ?? "", exclude, Math.min(Number(c.req.query("limit") ?? 8), 20)),
      );
    }),
  )
  .get(
    "/",
    handle(async (u, c) => {
      const sort = c.req.query("sort");
      return c.json(
        await listContacts(u.organizationId, u.userId, scope(c), {
          q: c.req.query("q") ?? undefined,
          domain: c.req.query("domain") ?? undefined,
          sort: sort === "name" || sort === "recent" ? sort : "rank",
          includeHidden: c.req.query("hidden") === "1",
          limit: Number(c.req.query("limit") ?? 200),
          offset: Number(c.req.query("offset") ?? 0),
        }),
      );
    }),
  )
  .post(
    "/",
    handle(async (u, c) => {
      const b = await body(c);
      return c.json(
        await createContact(
          u.organizationId,
          u.userId,
          { bookId: (b.bookId as string) ?? null, accountId: (b.accountId as string) ?? null, calendarId: (b.calendarId as string) ?? null },
          b,
        ),
        201,
      );
    }),
  )
  .patch(
    "/:id",
    handle(async (u, c) => c.json(await updateContact(u.organizationId, u.userId, c.req.param("id") ?? "", await body(c)))),
  )
  .post(
    "/:id/forget",
    handle(async (u, c) => {
      await forgetContact(u.organizationId, u.userId, c.req.param("id") ?? "");
      return c.json({ ok: true });
    }),
  )
  .get(
    "/:id/activity",
    handle(async (u, c) => c.json(await contactActivity(u.organizationId, u.userId, c.req.param("id") ?? ""))),
  );
