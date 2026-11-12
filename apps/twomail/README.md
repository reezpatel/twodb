# TwoMail

Initial IMAP/SMTP mail slice based on the legacy mail connector. This is not full
legacy parity or a production-hardened mail client.

## Implemented

- Space/workspace-scoped accounts; IMAP and SMTP verification before save.
- AES-256-GCM encrypted connection details, using an explicit operator data key.
- Mandatory TLS: implicit TLS for IMAP; implicit TLS or required STARTTLS for SMTP.
- Operator host allowlist prevents arbitrary tenant-selected network destinations.
- Manual inbox sync imports the latest 100 messages no larger than 2 MB each.
  IMAP UIDVALIDITY + UID identify imported messages; repeated imports deduplicate.
- Plain-text message reader; HTML and remote images are not rendered.
- Single-recipient plain-text compose and SMTP send, with local sent history.
- Persistent request IDs prevent concurrent/repeated submission from sending twice.
  Failed/ambiguous SMTP attempts become `unknown` and are never automatically retried.

## Configure and run

Provision a `twomail` Postgres schema through TwoDB. Set:

- `TWOMAIL_DATABASE_URL` or `DATABASE_URL`; otherwise credentials are fetched from
  the Gateway using `TWODB_PROVISION_TOKEN`.
- `TWOMAIL_DATA_KEY`: 32 random bytes as 64 hex characters. Generate with
  `openssl rand -hex 32`. Back this up securely; losing/changing it makes saved
  account credentials unreadable. There is no automated key rotation yet.
- `TWOMAIL_ALLOWED_HOSTS`: comma-separated exact IMAP/SMTP hostnames the operator
  trusts, e.g. `imap.example.com,smtp.example.com`. Empty means no connections.
  Approve only trusted DNS destinations; hostnames are resolved by the mail clients.
- `TWODB_GATEWAY_URL`: defaults to `http://localhost:6400`.

```
pnpm --filter @twodb/app-twomail dev
pnpm --filter @twodb/app-twomail-webapp dev
```

Backend: 6402. UI: 6501. Sign in to TwoDB with an active workspace and accessible
space. The UI proxies `/apps/twomail`, `/registry`, and `/api` to the Gateway.
Production hosting must provide equivalent same-origin routing over HTTPS.
Backend ports are Gateway-internal: do not expose them to callers able to forge
`x-twodb-*` identity headers.

**Shared-space warning:** every caller with access to a space can read mail and
send from accounts in that space. Use a private space for personal accounts.

## Verify

```
pnpm --filter @twodb/app-twomail build
pnpm --filter @twodb/app-twomail gen:docs
pnpm --filter @twodb/app-twomail-webapp build
TEST_DATABASE_URL=postgresql://.../disposable_database pnpm --filter @twodb/app-twomail exec tsx scripts/smoke.ts
```

Backend/frontend builds and Postgres integration tests pass. Tests cover encryption,
wrong-key rejection, host allowlisting, tenant isolation, import deduplication,
concurrent idempotent sending, and uncertain delivery. Mail transport is a stub in
these tests: actual IMAP/SMTP interoperability and browser interaction remain unverified.
No messages were sent to real recipients during development.

## Delivery semantics

A `sent` record means the SMTP server accepted the message, not that the recipient
received it. A process crash can leave `sending`; an SMTP exception yields `unknown`.
Check delivery before creating a new submission for either state. Retrying the same
request ID never resends; reusing it with changed content is rejected. IDs are scoped
to an account. Sent messages are stored locally, not appended to the provider's Sent
folder. Sending and database commit cannot be atomic, so this favors avoiding duplicate
mail over automatic retries.

## Remaining work

OAuth for Gmail/Microsoft, full mailbox sync/backfill/deletion reconciliation,
scheduled sync, folders/labels, threading, replies/forwarding, durable drafts,
attachments, HTML sanitization/rendering, read/unread state, account edit/disconnect,
per-account roles, rate limiting, contact suggestions, invitations, and background
outbox recovery are not implemented. Incoming body text is truncated at 100,000
characters; HTML-only mail shows a notice. The UI shows only the latest 100 stored
messages (API supports offset pagination). Compose drafts are in-memory only.
