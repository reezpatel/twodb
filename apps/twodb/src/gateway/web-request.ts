import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Converts a Fastify request into a standard Fetch API Request (for
 * better-auth's handler and the app proxy). Fastify's parsers may already
 * have consumed the raw stream — JSON bodies come back as parsed objects,
 * anything else as a Buffer (see the catch-all parser in server.ts) — so
 * re-serialize from `req.body` when it's present instead of touching the
 * disturbed `req.raw` stream.
 */
export function toWebRequest(req: FastifyRequest): Request {
  const protocol = (req.headers["x-forwarded-proto"] as string) ?? req.protocol;
  const url = `${protocol}://${req.headers.host}${req.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.append(key, value);
    else if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
  }

  let body: any;
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (Buffer.isBuffer(req.body)) {
      body = req.body;
    } else if (req.body !== undefined && req.body !== null) {
      body = JSON.stringify(req.body);
    } else {
      body = req.raw as any;
    }
    // Re-serialized/transformed bodies may differ in length from what the
    // client sent — let undici recompute framing.
    headers.delete("content-length");
  }

  return new Request(url, {
    method: req.method,
    headers,
    body,
    duplex: body ? "half" : undefined,
  } as any);
}

/** Writes a standard Fetch API Response back onto the raw Fastify/Node response, streaming the body. */
export async function sendWebResponse(reply: FastifyReply, response: Response): Promise<void> {
  // Headers other Fastify hooks already put on `reply` (notably @fastify/cors's Access-Control-Allow-Origin /
  // -Credentials / Vary) are NOT flushed when we write to the raw response, so carry them over first.
  const carried = reply.getHeaders();
  for (const [key, value] of Object.entries(carried)) {
    if (value !== undefined) reply.raw.setHeader(key, value as string | string[] | number);
  }
  reply.raw.statusCode = response.status;
  const setCookies = response.headers.getSetCookie?.() ?? [];
  response.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "content-encoding") return; // let Node handle framing itself
    if (k === "set-cookie") return; // written below, one header line per cookie (setHeader would overwrite)
    if (k === "vary") {
      // merge with Vary from hooks (e.g. `Origin`) instead of replacing it
      const prev = reply.raw.getHeader("vary");
      const merged = new Set([...String(prev ?? "").split(","), ...value.split(",")].map((v) => v.trim()).filter(Boolean));
      reply.raw.setHeader("vary", [...merged].join(", "));
      return;
    }
    reply.raw.setHeader(key, value);
  });
  if (setCookies.length) reply.raw.setHeader("set-cookie", setCookies);

  if (!response.body) {
    reply.raw.end();
    return;
  }

  const reader = response.body.getReader();
  reply.hijack();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      reply.raw.write(value);
    }
  } finally {
    reply.raw.end();
  }
}
