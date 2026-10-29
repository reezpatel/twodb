import { useEffect, useState } from "react";

export const LONG_THINKING = `The request is to move the footer widgets into blocks **without** changing behavior. Before touching anything I want to understand what the footer currently owns.

## What the footer does today

1. Renders the usage strip (input, output, cache, speed, context).
2. Renders the model picker, which is a *separate* concern but shares the row.
3. Renders the resources strip for the session's machine.
4. Persists which metric kinds are visible in \`localStorage\`.

That last point matters: persistence is **business logic**, so it cannot move into a block. The block must receive already-computed props.

### Options considered

- Keep one big \`ChatFooter\` component and only restyle it — fastest, but the route would keep the styling.
- Split into blocks and a hook — more files, but the route becomes a pure composition.
- Build a configurable \`<Footer items={[…]} />\` — flexible, but it hides the structure behind data.

> Compound composition reads better here. The existing blocks (\`NavSection*\`, \`CodeHeader*\`) already follow it, so staying consistent beats being clever.

### Checking the data path

\`\`\`ts
const cachePercent = stats.inputTokens > 0 ? Math.round((stats.cachedTokens / stats.inputTokens) * 100) : null;
const contextPercent = contextWindow ? Math.min(100, Math.round((stats.contextTokens / contextWindow) * 100)) : null;
\`\`\`

Both can be \`null\` — the block has to render an em dash rather than \`NaN%\`.

| Stat | Source | Can be empty |
| --- | --- | --- |
| input / output | session usage | no |
| cache hit | cached / input | yes |
| tok/s | last round | yes |
| context | context tokens / window | yes |

Edge cases to keep in mind:

- A brand new session has zero tokens everywhere.
- A model with an unknown context window has no percentage.
- A machine that is offline has no resources to show.

---

Plan: write the hook first, then the blocks, then replace the markup in the route. If the types line up on the first try that is a good sign; if not, the hook's return shape is wrong and I should fix it there rather than casting in the route.`;

export const LONG_MESSAGE = `# Footer migration

The footer is now built from blocks, and the route only composes them. Here is a walk-through of what changed and why.

## Summary

The work splits into **three layers**: presentational blocks, a data hook, and the route that wires them. Nothing in the blocks knows about React Query, \`localStorage\` or the websocket — they take *already-computed* props and render them.

### What moved

| File | Before | After |
| --- | --- | --- |
| \`chat-footer.tsx\` | ~60 lines of markup + math | deleted |
| \`footer-resources.tsx\` | markup + persistence + queries | deleted |
| \`use-chat-footer-status.ts\` | — | new hook, no markup |
| \`code-chat-usage.tsx\` | — | new block |

### The new hook

\`\`\`ts
export function useChatFooterStatus(stats: SessionStats, contextWindow: number | null) {
  const runners = useRunners();
  const live = useLiveRunnerMetrics(true);
  const { runnerId } = useSessionDirectory();
  // …returns { usage, machines, toggleKind }
}
\`\`\`

### Rendering it

\`\`\`tsx
<CodeChatStatusBar>
  <CodeChatUsage>
    <CodeChatUsageStat title="Output tokens">↓ {usage.output}</CodeChatUsageStat>
    <CodeChatUsageContext percent={usage.contextPercent} label={usage.contextLabel} />
  </CodeChatUsage>
</CodeChatStatusBar>
\`\`\`

\`\`\`bash
pnpm --filter @twodb/desktop exec tsc --noEmit
pnpm exec prettier --write src/routes/code/chat
\`\`\`

\`\`\`json
{ "usage": { "input": "12.4k", "output": "3.1k", "cache": "71%" } }
\`\`\`

\`\`\`diff
- <ChatFooter stats={stats} contextWindow={contextWindow} modelPicker={modelPicker} />
+ <CodeChatStatusBar>…</CodeChatStatusBar>
\`\`\`

## Things worth knowing

1. **Persistence key is unchanged** — saved settings still apply.
2. The context ring changes *hue*, never *size*, at the warning thresholds.
3. Nested lists work too:
   - the warning threshold is \`80%\`
   - the danger threshold is \`95%\`
     - both are props, not constants
4. Inline code such as \`useReducedMotion()\`, a [regular link](https://example.com) and ~~strikethrough~~ all render.

- [x] Blocks written
- [x] Route migrated
- [ ] Transcript still uses the old markup

> **Note**
> The transcript is the next piece. Until then the footer is narrower than the messages above it.

Here is a very long unbroken token to check wrapping: \`aVeryLongIdentifierThatKeepsGoingAndGoingWithoutAnySpacesToSeeHowTheLayoutHandlesOverflowInsideAnInlineCodeSpan\`.

---

### Task list for review

1. Open the footer in Storybook and toggle each state.
2. Resize the window below the \`lg\` breakpoint.
3. Check the ring colors in the light and dark themes.

Let me know if you want the resources strip moved into the status bar as well.`;

export const MARKDOWN_SHOWCASE = `# Heading 1
## Heading 2
### Heading 3

Paragraph with **bold**, *italic*, ***both***, ~~strikethrough~~, \`inline code\`, and a [link](https://example.com).

A second paragraph, long enough to wrap onto several lines so line height, spacing and the maximum width of the thread can be judged together. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

- Unordered item one
- Unordered item two
  - Nested item
    - Deeply nested item
- Unordered item three

1. Ordered item one
2. Ordered item two
   1. Nested ordered
   2. Nested ordered
3. Ordered item three

- [x] Done task
- [ ] Open task

> A blockquote with *emphasis*.
>
> A second paragraph in the same quote.

| Left | Center | Right |
| :--- | :----: | ----: |
| a | b | c |
| longer cell content | middle | 12,345 |

\`\`\`tsx
export function Example({ name }: { name: string }) {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{name}: {count}</button>;
}
\`\`\`

\`\`\`python
def fib(n: int) -> int:
    return n if n < 2 else fib(n - 1) + fib(n - 2)
\`\`\`

\`\`\`sql
select id, title from code_session where organization_id = $1 order by updated_at desc limit 20;
\`\`\`

\`\`\`
a fenced block with no language
keeps its whitespace   exactly
\`\`\`

---

Final paragraph after a horizontal rule.`;

export const LIVE_THINKING = `Reading the sidebar route to see how the git section is built.

The section already has the data hook; what's missing is a block that renders **grouped files**. I'll write the block first, then the hook that groups by folder, then swap the route.

- the hook returns precomputed groups
- the block stays presentational`;

export const LIVE_MESSAGE = `Done — the git section is now a block.

## What changed

- \`code-commit.tsx\` renders the header, folders and files
- \`use-sidebar-git.ts\` groups the changes by folder
- the route only composes the blocks

\`\`\`bash
pnpm exec tsc --noEmit
\`\`\`

Type-check passes. Want me to wire up *Open diff* next?`;

const TICK_MS = 50;
const CHARS_PER_TICK = 4;
const TOOL_ONE_TICKS = 40;
const TOOL_TWO_TICKS = 60;

export type LivePhase = "idle" | "thinking" | "tool-one" | "tool-two" | "message" | "done";

export interface LiveRound {
  phase: LivePhase;
  running: boolean;
  thinking: string;
  message: string;
  toolOneSeconds: string;
  toolTwoSeconds: string;
  start: () => void;
  pause: () => void;
  restart: () => void;
}

/**
 * Simulates one agent round as a pure function of elapsed ticks:
 * thinking streams → tool one runs → tool two runs → the message streams.
 */
export function useLiveRound({ autoStart = true }: { autoStart?: boolean } = {}): LiveRound {
  const [ticks, setTicks] = useState(0);
  const [running, setRunning] = useState(autoStart);

  const thinkTicks = Math.ceil(LIVE_THINKING.length / CHARS_PER_TICK);
  const messageTicks = Math.ceil(LIVE_MESSAGE.length / CHARS_PER_TICK);
  const toolOneStart = thinkTicks;
  const toolTwoStart = toolOneStart + TOOL_ONE_TICKS;
  const messageStart = toolTwoStart + TOOL_TWO_TICKS;
  const end = messageStart + messageTicks;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setTicks((current) => {
        if (current >= end) {
          setRunning(false);
          return current;
        }
        return current + 1;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running, end]);

  const phase: LivePhase =
    ticks === 0 && !running
      ? "idle"
      : ticks < toolOneStart
        ? "thinking"
        : ticks < toolTwoStart
          ? "tool-one"
          : ticks < messageStart
            ? "tool-two"
            : ticks < end
              ? "message"
              : "done";

  const seconds = (elapsed: number, total: number) => `0:0${Math.min(total, Math.floor((elapsed * TICK_MS) / 1000))}`;

  return {
    phase,
    running,
    thinking: LIVE_THINKING.slice(0, Math.min(ticks, thinkTicks) * CHARS_PER_TICK),
    message: LIVE_MESSAGE.slice(0, Math.max(0, ticks - messageStart) * CHARS_PER_TICK),
    toolOneSeconds: seconds(Math.max(0, ticks - toolOneStart), 2),
    toolTwoSeconds: seconds(Math.max(0, ticks - toolTwoStart), 3),
    start: () => setRunning(true),
    pause: () => setRunning(false),
    restart: () => {
      setTicks(0);
      setRunning(true);
    },
  };
}
