# TwoChat

Slack-style workspace chat for the TwoDB ecosystem. TwoChat supports group
channels, private DMs, threads, reactions, pins, saved messages, drafts,
read-state, realtime presence/typing, attachments, user notifications, and
first-class bot/agent participants.

Shape: `backend+webapp`

## Architecture

- **Backend:** Fastify + Kysely in the provisioned `twochat` Postgres schema.
- **Identity:** resolved by the TwoDB Gateway and forwarded through
  `x-twodb-*` headers. TwoChat never talks to better-auth directly.
- **Realtime:** `/ws`, declared in the app manifest and bridged by the Gateway.
- **Attachments:** `StorageAdapter` boundary in `src/storage.ts`. Local storage
  works now; `twodrive` is an intentionally loud stub until TwoDrive's S3 API
  ships. No route or message shape needs to change when it does.
- **Async events:** Postgres-backed `core-async` broadcasts for new messages,
  notifications, and interactive message actions.
- **API contract:** `src/manifest.ts` is the source of truth. Run
  `pnpm gen:docs` to regenerate `ENDPOINTS.md` and `endpoint.json`.

## Local development

```bash
# Postgres must be up and TwoDB should have provisioned the twochat schema.
pnpm --filter @twodb/app-twochat dev
pnpm --filter @twodb/app-twochat-webapp dev
```

Backend defaults to port `6405`; the webapp uses `6501` and proxies all API,
auth, and WebSocket traffic through the Gateway at `6400`.

## Agent and bot participation

Agents are first-class chat members rather than a side-channel:

1. Create a workspace API key in TwoDB.
2. Register a bot with `POST /apps/twochat/bots`, binding its `apiKeyId`.
   An unbound API key can also self-bootstrap: its first API-key request creates
   a generic `bot-<key>` participant.
3. Read channel history through `GET /channels/:id/messages`.
4. Post text or composed blocks through `POST /bots/webhook`.
5. Read durable button clicks through `GET /bots/actions`, process them, then
   acknowledge with `POST /bots/actions/:id/ack`.

Example rich bot post:

```json
{
  "channelName": "engineering",
  "blocks": [
    {
      "type": "callout",
      "tone": "success",
      "title": "Deploy complete",
      "text": "Release 42 is healthy."
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "actionId": "inspect_release",
          "text": "Inspect",
          "value": "release-42",
          "style": { "tone": "primary" }
        }
      ]
    }
  ]
}
```

The full block vocabulary is in `src/blocks.ts`: markdown, dividers, images,
action buttons, link buttons, fields, context/mentions, attachments, link
cards, quotes, status strips, code, task lists, and callouts.
