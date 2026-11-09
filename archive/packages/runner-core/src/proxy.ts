import * as http from "node:http";
import { WebSocket } from "ws";

/** Localhost HTTP/WS proxying on the runner: the server tunnels requests to
 *  a port on this machine (the per-workdir code-server) through the runner
 *  connection. Only loopback targets are allowed. */

export interface ProxyHttpRequest {
  requestId: string;
  port: number;
  method: string;
  path: string;
  headers: Record<string, string>;
  bodyBase64?: string;
}

const MAX_BODY = 100 * 1024 * 1024;

/** Performs one HTTP request against 127.0.0.1:<port> and reports the
 *  response back through `send`. Bodies stream as base64 chunks. */
export function handleProxyHttp(req: ProxyHttpRequest, send: (msg: unknown) => void): void {
  const upstream = http.request(
    {
      host: "127.0.0.1",
      port: req.port,
      method: req.method,
      path: req.path,
      headers: { ...req.headers, host: `127.0.0.1:${req.port}` },
      timeout: 60_000,
    },
    (res) => {
      send({ type: "proxyHttpResponse", requestId: req.requestId, status: res.statusCode ?? 502, headers: res.headers });
      res.on("data", (chunk: Buffer) => send({ type: "proxyHttpChunk", requestId: req.requestId, dataBase64: chunk.toString("base64") }));
      res.on("end", () => send({ type: "proxyHttpEnd", requestId: req.requestId }));
      res.on("error", () => send({ type: "proxyHttpEnd", requestId: req.requestId, error: true }));
    },
  );
  upstream.on("timeout", () => upstream.destroy(new Error("timeout")));
  upstream.on("error", (e) => {
    send({ type: "proxyHttpResponse", requestId: req.requestId, status: 502, headers: {} });
    send({ type: "proxyHttpEnd", requestId: req.requestId, error: (e as Error).message });
  });
  if (req.bodyBase64) {
    const body = Buffer.from(req.bodyBase64, "base64");
    if (body.length > MAX_BODY) {
      upstream.destroy();
      send({ type: "proxyHttpResponse", requestId: req.requestId, status: 413, headers: {} });
      send({ type: "proxyHttpEnd", requestId: req.requestId, error: "body too large" });
      return;
    }
    upstream.write(body);
  }
  upstream.end();
}

const STRIP_HEADERS = new Set([
  "host",
  "connection",
  "upgrade",
  "sec-websocket-key",
  "sec-websocket-version",
  "sec-websocket-protocol",
  "sec-websocket-extensions",
  "origin", // code-server origin-checks against its loopback origin
]);

/** WS tunnel: a real WebSocket client to the local target, frames relayed
 *  over the runner connection as base64. Using `ws` (already a dep) instead
 *  of hand-rolled TCP keeps the handshake/framing correct. */
export class ProxyWsTunnel {
  private ws: WebSocket | null = null;
  private queue: string[] = []; // frames that arrived before the socket opened

  constructor(
    private channelId: string,
    port: number,
    path: string,
    headers: Record<string, string>,
    protocols: string[],
    private send: (msg: unknown) => void,
  ) {
    const forwardHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) if (!STRIP_HEADERS.has(k.toLowerCase())) forwardHeaders[k] = v;

    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, protocols, { headers: forwardHeaders });
    this.ws = ws;

    ws.on("open", () => {
      this.send({ type: "proxyWsOpen", channelId: this.channelId });
      for (const frame of this.queue) ws.send(Buffer.from(frame, "base64"));
      this.queue = [];
    });
    ws.on("message", (data: Buffer | string) => {
      const buf = typeof data === "string" ? Buffer.from(data) : data;
      this.send({ type: "proxyWsData", channelId: this.channelId, dataBase64: buf.toString("base64") });
    });
    ws.on("close", (code: number, reason: Buffer) => {
      this.send({ type: "proxyWsClose", channelId: this.channelId, code, reason: reason.toString() });
    });
    ws.on("error", (e: Error) => {
      this.send({ type: "proxyWsClose", channelId: this.channelId, code: 1006, reason: e.message });
    });
  }

  /** Browser → upstream frame. */
  write(dataBase64: string) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(Buffer.from(dataBase64, "base64"));
    else this.queue.push(dataBase64);
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }
}
