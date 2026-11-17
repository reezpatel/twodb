/**
 * Translates Anthropic Messages SSE into OpenAI chat.completion.chunk SSE.
 *
 * TwoRoute's /v1/chat/completions contract is OpenAI-shaped (Artisan, the CLI
 * and every other caller parse choices[0].delta), but Anthropic-wire
 * providers stream their own event vocabulary. Legacy parsed Anthropic
 * natively inside its agent loop; here the translation lives at the edge so
 * the pass-through stream is already OpenAI-shaped.
 *
 * Mapping:
 *  - content_block_delta(text_delta)            → delta.content
 *  - content_block_delta(thinking_delta)        → delta.reasoning_content
 *  - content_block_start(tool_use)              → delta.tool_calls[i] {id, function.name, arguments:""}
 *  - content_block_delta(input_json_delta)      → delta.tool_calls[i] {function.arguments}
 *  - message_delta.stop_reason                  → finish_reason (end_turn→stop, tool_use→tool_calls, max_tokens→length)
 *  - message_start / message_delta usage        → final usage chunk (prompt_tokens includes cache tokens)
 *  - message_stop                               → final usage chunk + [DONE]
 */

export interface AnthropicStreamState {
  /** Anthropic block index → OpenAI tool_calls index (only tool_use blocks). */
  toolIndexByBlock: Map<number, number>;
  nextToolIndex: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  finishReason: string | null;
  usageEmitted: boolean;
}

export function createAnthropicTranslator(model: string) {
  const state: AnthropicStreamState = {
    toolIndexByBlock: new Map(),
    nextToolIndex: 0,
    inputTokens: 0,
    cachedTokens: 0,
    finishReason: null,
    usageEmitted: false,
    outputTokens: 0,
  };

  const chunk = (delta: Record<string, unknown>, finishReason: string | null = null, usage: unknown = undefined) =>
    `data: ${JSON.stringify({
      id: "chatcmpl-tworoute",
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, delta, finish_reason: finishReason }],
      ...(usage ? { usage } : {}),
    })}\n\n`;

  /** Translate one SSE `data:` payload. Returns OpenAI SSE text to emit (may be ""). */
  function translate(payload: string): string {
    if (!payload || payload === "[DONE]") return "";
    let evt: Record<string, any>;
    try {
      evt = JSON.parse(payload);
    } catch {
      return "";
    }
    const type = String(evt.type ?? "");
    let out = "";

    if (type === "message_start") {
      const u = evt.message?.usage ?? {};
      // Anthropic reports cache tokens separately; fold them in so
      // prompt_tokens is the full context the model saw.
      state.inputTokens = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
      state.cachedTokens = u.cache_read_input_tokens ?? 0;
      out += chunk({ role: "assistant" });
    } else if (type === "content_block_start") {
      const block = evt.content_block ?? {};
      if (block.type === "tool_use") {
        const idx = state.nextToolIndex++;
        state.toolIndexByBlock.set(Number(evt.index), idx);
        out += chunk({ tool_calls: [{ index: idx, id: String(block.id ?? ""), type: "function", function: { name: String(block.name ?? ""), arguments: "" } }] });
      }
    } else if (type === "content_block_delta") {
      const delta = evt.delta ?? {};
      if (delta.type === "text_delta" && typeof delta.text === "string") {
        out += chunk({ content: delta.text });
      } else if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
        out += chunk({ reasoning_content: delta.thinking });
      } else if (delta.type === "input_json_delta" && typeof delta.partial_json === "string") {
        const idx = state.toolIndexByBlock.get(Number(evt.index));
        if (idx !== undefined) out += chunk({ tool_calls: [{ index: idx, function: { arguments: delta.partial_json } }] });
      }
    } else if (type === "message_delta") {
      const stop = evt.delta?.stop_reason;
      if (stop) {
        state.finishReason = stop === "end_turn" ? "stop" : stop === "tool_use" ? "tool_calls" : stop === "max_tokens" ? "length" : String(stop);
      }
      const u = evt.usage ?? {};
      if (typeof u.output_tokens === "number") state.outputTokens = u.output_tokens;
    } else if (type === "message_stop") {
      out += emitFinal(state, chunk);
    }
    return out;
  }

  function emitFinal(st: AnthropicStreamState, ch: typeof chunk): string {
    if (st.usageEmitted) return "";
    st.usageEmitted = true;
    const usage = {
      prompt_tokens: st.inputTokens,
      completion_tokens: st.outputTokens,
      total_tokens: st.inputTokens + st.outputTokens,
      ...(st.cachedTokens ? { prompt_tokens_details: { cached_tokens: st.cachedTokens } } : {}),
    };
    // finish_reason rides its own chunk, usage on the same one (OpenAI sends them together at the end).
    return ch({}, st.finishReason ?? "stop", usage);
  }

  return {
    translate,
    /** Stream ended without message_stop — still close out cleanly. */
    finalize: () => (state.usageEmitted ? "" : emitFinal(state, chunk)),
  };
}

/** True when this connection streams Anthropic events (needs translation). */
export function isAnthropicWire(api: string | undefined): boolean {
  return api === "anthropic";
}
