import { z } from "zod";
import { defineAppMessages } from "@twodb/core-async/registry";

export const tworouteMessages = defineAppMessages({
  name: "TwoRoute",
  slug: "tworoute",
  jobs: [],
  events: [
    {
      // Declared for consumers (billing dashboards, rate-limiters). Emitted
      // via core-async's broadcast on the workspace channel; v1 emits it
      // fire-and-forget from the completions route — a broadcast failure
      // never breaks a completion.
      event: "llm.completion.recorded",
      description: "One completed LLM call, with token counts — the basis for any future quota/billing.",
      direction: "produces",
      payload: z.object({
        connectionId: z.string(),
        model: z.string(),
        inputTokens: z.number().nullable(),
        outputTokens: z.number().nullable(),
        latencyMs: z.number(),
        status: z.enum(["ok", "error"]),
      }),
    },
  ],
});

export default tworouteMessages;
