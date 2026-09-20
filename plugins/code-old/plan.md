# plan.md — code plugin: live agent sessions

Wire real agent interaction into the code scene. When a session is selected,
the web opens a websocket to the code plugin, syncs current state, then streams
new messages (assistant deltas, tool calls/outputs, user messages). Reconnects
catch up to the latest state. The agent plugin drives threads; the code plugin
owns the session's tools and the node they run on.

## Locked decisions

1. **Transport** — per-session WS endpoint:
   `GET /api/v1/io.twodb.code/sessions/:id/ws`. Cookie/principal auth on the
   upgrade (identity hook runs for WS routes; require workspace membership).
   One socket per selected session; closed on deselect.
2. **Streaming** — full token streaming. The pi agent already emits
   `message_start` / `message_update` (deltas) / `message_end`; the agent
   runtime forwards them through the thread handle; the code plugin relays
   them onto the session socket.
3. **Telemetry** — usage (tokens in/out, ctx size, tok/s) rides the stream
   on-change. Node ram/cpu is pushed on the same socket every ~5s from the
   node's last heartbeat, via a new decorated `nodeStats(nodeId)`.
4. **Tools (6)** — `find_file` (fzf, cwd param defaults to session cwd),
   `read_file`, `write_file`, `run_command`, `edit_file` (exact
   search/replace blocks; fails on 0 or >1 matches), `apply_patch` (unified
   diff via `git apply`, fallback `patch`). All execute on the session's node
   via `nodeInvoke`; cwd is injected per session (worktree override > cwd).
5. **Pagination** — agent messages paged by seq cursor:
   `?before=<seq>&limit=50`, newest-first pages. Tool outputs trimmed to
   ~10k chars in DTOs; full output on demand via a single-message endpoint
   (`GET /messages/:id`). Web keeps ~50 rendered, loads older pages on
   scroll-up.
6. **Agent binding** — agent picker in the New Session dialog (third field;
   agents listed through a decorated `agentList(workspaceId)` from the agent
   plugin, mirrored by a code-plugin `GET /agents` — same isolation pattern
   as the node picker). Mid-chat model change is allowed: `PATCH
   /sessions/:id` with `agent_id` + `mode: "continue" | "compact"`. Compact
   summarizes history via pi's compaction (`generateSummary`/`compact`)
   before switching; continue keeps full history.
7. **Plan location** — this file only; inline checklist below.

## Current state (what exists)

- agent plugin: `fastify.agents` runtime; threads + messages persisted with
  ordered `seq`; handle events `message`, `tool-start/update/end`,
  `run-finished/failed`; messages persisted on `message_end` (full payload);
  `listMessages` returns all messages (no pagination); thread rebuilds the pi
  agent per prompt so config/tool edits apply next run.
- code plugin: session↔thread binding (`thread_id`), `ensureThread` lazily
  creates threads; tools registered per session via `buildNodeTools` (5
  tools, no patch/edit); REST prompt/stop/messages.
- node plugin: `nodeInvoke`, `nodeList`, `nodeGet`, `nodeFindDirs`
  decorated; heartbeat details (cpus, loadavg, memory) persisted in
  `node_nodes.last_heartbeat` jsonb.
- pi-agent-core: emits `message_start`/`message_update` (with
  `AssistantMessageEvent`), assistant messages carry `usage`; ships
  compaction utilities (`compact`, `generateSummary`,
  `estimateContextTokens`, `shouldCompact`).

## Build checklist

### 1. Contracts (`packages/contracts`)

- [x] `AgentThreadListener` event payloads: add typed payloads for
      `message-start`, `message-update` (delta), `usage` (cumulative in/out,
      ctx tokens, tok/s).
- [x] `AgentRuntime.listMessages(threadId, { before?, after?, limit? })` —
      paginated (both cursors).
- [x] `AgentRuntime.getMessage(messageId)` — full untrimmed message.
- [x] `AgentRuntime.compactThread(threadId)` — summarize + prune history.
- [x] `AgentSummary` + `agentList?: AgentListFn` on `TwodbFastifyInstance`.
- [x] `NodeStats` + `nodeStats?: NodeStatsFn` on `TwodbFastifyInstance`.

### 2. Agent plugin

- [x] Runtime: forward `message_start` / `message_update` (delta + partial
      message) on handle events; keep persisting only `message_end`.
- [x] Usage events: cumulative in/out tokens, ctx estimate, live tok/s
      (delta chars over wall-clock, throttled to 250ms; final at run end).
- [x] Paginated `listMessages` (before/after/limit) + tool outputs trimmed
      (~10k chars) with a `truncated` flag in DTOs.
- [x] `getMessage` (untrimmed) for the view-full-output button.
- [x] `compactThread`: one-shot summarizer agent replaces history with a
      single summary message (seq restarts at 0).
- [x] Decorate `agentList(workspaceId)` (id, name, provider, model, enabled)
      via `lib/decorate.ts`.
- [x] HTTP: paginate `GET /threads/:id/messages` (before/limit); add
      `GET /threads/:id/messages/:messageId` (full); `POST /threads/:id/compact`.

### 3. Node plugin + agent (`apps/node`)

- [x] Decorate `nodeStats(nodeId)`: last heartbeat details + online status
      (gateway registry, not the stale DB flag).
- [x] Agent action `edit_file`: exact search/replace; `NO_MATCH` /
      `AMBIGUOUS_MATCH` errors.
- [x] Agent action `apply_patch`: `git apply --check` then apply; `patch -p1`
      fallback outside git repos.
- [x] Rebuild `twodb-node:local` image + recreate container.

### 4. Code plugin service

- [x] WS endpoint `sessions/:id/ws` (identity hook guards the upgrade —
      verified 401 unauthenticated):
      - client frames: `{type:"sync", after_seq?}`, `{type:"prompt", text,
        images?}`, `{type:"stop"}`;
      - server frames: `snapshot` (session, running, latest 50 messages
        trimmed, usage-so-far, incremental flag), `message-start|update|end`,
        `tool-start|update|end`, `usage`, `stats` (5s tick), `run-state`,
        `compacted`, `error`;
      - reconnect with `after_seq` → replay persisted messages past the
        cursor, then live;
      - relay: subscribe thread handle events → socket; cleanup on close.
- [x] `GET /agents` route → `fastify.agentList` (picker isolation pattern).
- [x] `PATCH /sessions/:id`: `agent_id` change with `mode: "continue" |
      "compact"` (compact → `fastify.agents.compactThread`).
- [x] `buildNodeTools`: added `edit_file` + `apply_patch`; cwd injection
      unchanged (worktree override > session cwd).
- [x] Session `running` derived from the agent runtime (`isRunning`) in
      DTOs — sidenav status dot is live.

### 5. Code plugin view

- [x] `useSessionStream` hook: WS lifecycle keyed on selected session
      (connect/sync/catch-up/reconnect), message window, live delta append,
      run state, usage + stats state.
- [x] ChatSection rewrite: user/assistant/tool rendering, streaming
      assistant text, trimmed tool blocks + "view full output", composer
      (prompt over WS, ⌘⏎), stop button.
- [x] Scroll-up pagination: `before`-seq pages on top reach + explicit
      "Load older messages" button.
- [x] Usage/status bar: tokens in/out, ctx, tok/s (stream) + node ram/cpu
      (stats tick).
- [x] New Session dialog: agent Select (via code plugin `GET /agents`).
- [x] Model switcher in the composer bar; confirm dialog with
      keep-history (continue) vs compact & switch.

## Risks / notes

- WS auth depends on the identity hook populating `request.principal` during
  the upgrade — verify early with a stub endpoint before building the relay.
- `apps/node` image rebuild is required for the new agent actions; the local
  `tsx watch` agent must stay disabled (or it fights the docker identity).
- Tool-output trimming must keep the `truncated` marker so the UI only shows
  the expand button when something was actually cut.
- Compaction changes history ordering assumptions — pagination must tolerate
  pruned gaps (seq stays monotonic; pages may be shorter).
