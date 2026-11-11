import type { ToolSpec } from "../agent-loop.js";

/** ask_user — only meaningful in interactive sessions with viewers. */
export function askUserTool(): ToolSpec {
  return {
    name: "ask_user",
    description:
      "Asks the user one or more questions and waits for answers. Use when a decision, choice, or " +
      "clarification is needed instead of guessing. Each question may offer options; the user can " +
      "always answer freely.",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              allowMultiple: { type: "boolean" },
            },
            required: ["question"],
          },
        },
      },
      required: ["questions"],
    },
    async execute(args, ctx) {
      const questions = (args.questions as Array<{ question: string; options?: string[]; allowMultiple?: boolean }>) ?? [];
      if (!ctx.session.interactive) {
        return "no viewer: this session is headless — proceed with your best judgment and note the decision.";
      }
      const res = await ctx.askUser(questions);
      if (res.cancelled) return "the user cancelled this question — proceed with your best judgment";
      if (!res.answers) return "no answer received (no viewer) — proceed with your best judgment";
      return questions.map((q, i) => `Q: ${q.question}\nA: ${res.answers?.[i] ?? "(skipped)"}`).join("\n\n");
    },
  };
}

