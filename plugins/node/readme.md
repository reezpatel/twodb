# @twodb/node — io.twodb.node

Machines: the places where code actually runs — linux boxes, macs, windows
desktops, docker containers. This plugin owns the machine registry, streams
command output, and applies fast patches. File reading/listing is
intentionally NOT special-cased: run `cat` / `ls` as commands.

## Surface

- `POST /nodes` — create a machine, returns a one-time agent token
- `GET /nodes` · `PATCH /nodes/:id` · `DELETE /nodes/:id` · `POST /nodes/:id/token`
- `POST /nodes/:id/commands` — queue a shell command on the machine
- `GET /commands/:id/stream` — SSE: `start | chunk | exit | error` events
  (stdout/stderr interleaved, llm-tool friendly)
- `POST /commands/:id/kill`
- `POST /nodes/:id/patch` — fast patch: line splices with optional base hash
- `GET /patches/:id` — patch status (pending → applied | failed)

Agent endpoints (bearer node token):

- `POST /agent/hello` · `POST /agent/bye`
- `GET /agent/queue` — SSE downlink: `command | kill | patch | ping`
- `POST /agent/commands/:id/start|chunk|exit`
- `POST /agent/patches/:id/result`

## Cross-plugin (app.invoke)

- `node.runCommand({nodeId, command, cwd?, timeoutMs?}) → {commandId}`
- `node.commandStatus(commandId) → {command, output} | null`
- `node.patch({nodeId, path, baseHash?, ops}) → {patchId}`

## Fast patch protocol

`ops` are line splices over `content.split("\n")`, applied highest-index
first: `{start, delete_count, lines[]}`. `base_hash` (sha256 of current
utf8 content) makes application atomic — a mismatch fails with
`base_mismatch` instead of clobbering.

## Agent

`apps/node` runs on each machine:

```bash
TWODB_NODE_URL=http://your-api:3001 \
TWODB_NODE_TOKEN=<token from create machine> \
TWODB_ROOT=/path/to/project \
pnpm --filter twodb-node start
```

It holds one SSE connection to `/agent/queue`, executes commands through
the platform shell, batches stdout/stderr into ~40ms chunk posts, and
applies patches inside `TWODB_ROOT` only.
