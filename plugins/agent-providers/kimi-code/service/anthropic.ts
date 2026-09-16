export type AnthropicContentBlock =
	| { type: "text"; text: string }
	| {
			type: "image";
			source: { type: "base64"; media_type: string; data: string };
	  }
	| {
			type: "tool_use";
			id: string;
			name: string;
			input: Record<string, unknown>;
	  }
	| {
			type: "tool_result";
			tool_use_id: string;
			content: string;
			is_error?: boolean;
	  };

export type AnthropicMessage = {
	role: "user" | "assistant";
	content: AnthropicContentBlock[];
};

export type AnthropicTool = {
	name: string;
	description: string;
	input_schema: object;
};

export type AnthropicThinkingConfig = {
	type: "enabled";
	budget_tokens: number;
};

export interface AnthropicMessagesRequest {
	model: string;
	maxTokens: number;
	system?: string;
	messages: AnthropicMessage[];
	tools?: AnthropicTool[];
	thinking?: AnthropicThinkingConfig;
}

export type AnthropicStreamEvent =
	| {
			type: "message_start";
			message: { id?: string; usage?: Record<string, unknown> };
	  }
	| {
			type: "content_block_start";
			index: number;
			content_block: Record<string, unknown>;
	  }
	| {
			type: "content_block_delta";
			index: number;
			delta: Record<string, unknown>;
	  }
	| { type: "content_block_stop"; index: number }
	| {
			type: "message_delta";
			delta: { stop_reason?: string | null };
			usage?: { output_tokens?: number };
	  }
	| { type: "message_stop" }
	| { type: "ping" }
	| { type: "error"; error: { type?: string; message?: string } };

function sanitizeError(text: string, maxLength = 200): string {
	const sanitized = text.replace(/\s+/g, " ").trim();
	return (sanitized || "unknown").slice(0, maxLength);
}

const debug = (message: string): void => {
	console.log(`[kimi-code] ${message}`);
};

function eventData(rawEvent: string): string | null {
	const parts: string[] = [];
	for (const line of rawEvent.split("\n")) {
		const trimmed = line.replace(/\r$/, "");
		if (trimmed.startsWith("data:")) parts.push(trimmed.slice(5).trimStart());
	}
	return parts.length ? parts.join("\n") : null;
}

export async function* streamAnthropicMessages(
	url: string,
	apiKey: string,
	request: AnthropicMessagesRequest,
	signal: AbortSignal,
): AsyncGenerator<AnthropicStreamEvent> {
	const response = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"anthropic-version": "2023-06-01",
			"content-type": "application/json",
			accept: "text/event-stream",
		},
		body: JSON.stringify({
			model: request.model,
			max_tokens: request.maxTokens,
			stream: true,
			...(request.system ? { system: request.system } : {}),
			messages: request.messages,
			...(request.tools?.length ? { tools: request.tools } : {}),
			...(request.thinking ? { thinking: request.thinking } : {}),
		}),
		signal,
	});

	debug(
		`POST ${url} model=${request.model} messages=${request.messages.length} tools=${request.tools?.length ?? 0}`,
	);

	if (!response.ok) {
		throw new Error(
			`API error ${response.status}: ${sanitizeError(await response.text())}`,
		);
	}
	if (!response.body) {
		throw new Error("API returned an empty response body");
	}

	const reader = response.body.getReader();
	debug(`response ${response.status}, streaming`);
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		let boundary = /\r?\n\r?\n/.exec(buffer);
		while (boundary !== null) {
			const rawEvent = buffer.slice(0, boundary.index);
			buffer = buffer.slice(boundary.index + boundary[0].length);
			boundary = /\r?\n\r?\n/.exec(buffer);

			const data = eventData(rawEvent);
			if (!data) continue;

			let parsed: AnthropicStreamEvent;
			try {
				parsed = JSON.parse(data) as AnthropicStreamEvent;
			} catch {
				throw new Error(`Invalid SSE payload: ${sanitizeError(data)}`);
			}
			debug(`sse ${parsed.type}`);
			yield parsed;
		}
	}

	debug("stream closed by server");
}
