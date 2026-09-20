import { config } from "./config";

export const post = async (path: string, body?: unknown): Promise<unknown> => {
  const response = await fetch(`${config.apiUrl}/api/v1/io.twodb.node${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) {
    throw new Error(`POST ${path} → ${response.status}: ${await response.text()}`);
  }
  return response.json();
};

export const getStream = async (path: string): Promise<ReadableStream<Uint8Array>> => {
  const response = await fetch(`${config.apiUrl}/api/v1/io.twodb.node${path}`, {
    headers: { authorization: `Bearer ${config.token}`, accept: "text/event-stream" },
  });
  if (!response.ok || !response.body) {
    throw new Error(`GET ${path} → ${response.status}`);
  }
  return response.body;
};
