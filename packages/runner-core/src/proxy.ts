import * as http from "node:http";
import * as net from "node:net";
import * as crypto from "node:crypto";

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

/** WS tunnel: server↔runner frames become a raw TCP socket to the local
 *  target, performing the WebSocket handshake with the headers the server
 *  forwarded (path, protocols, cookies). Frames relay both ways as base64. */
export class ProxyWsTunnel {
  private socket: net.Socket | null = null;
  private handshook = false;
  private leftover: Buffer = Buffer.alloc(0);

  constructor(
    private channelId: string,
    private port: number,
    private path: string,
    private headers: Record<string, string>,
    private protocols: string[],
    private send: (msg: unknown) => void,
  ) {
    this.connect();
  }

  private connect() {
    const socket = net.connect(this.port, "127.0.0.1");
    this.socket = socket;
    const key = crypto.randomBytes(16).toString("base64");
    const lines = [
      `GET ${this.path} HTTP/1.1`,
      `Host: 127.0.0.1:${this.port}`,
      "Connection: Upgrade",
      "Upgrade: websocket",
      `Sec-WebSocket-Key: ${key}`,
      "Sec-WebSocket-Version: 13",
      ...(this.protocols.length ? [`Sec-WebSocket-Protocol: ${this.protocols.join(", ")}`] : []),
      ...Object.entries(this.headers)
        .filter(([k]) => !["host", "connection", "upgrade", "sec-websocket-key", "sec-websocket-version", "sec-websocket-protocol"].includes(k.toLowerCase()))
        .map(([k, v]) => `${k}: ${v}`),
      "",
      "",
    ];
    socket.write(lines.join("\r\n"));

    let head = Buffer.alloc(0);
    const onData = (chunk: Buffer) => {
      if (!this.handshook) {
        head = Buffer.concat([head, chunk]);
        const end = head.indexOf("\r\n\r\n");
        if (end === -1) return;
        const statusLine = head.subarray(0, head.indexOf("\r\n")).toString();
        if (!statusLine.includes("101")) {
          this.send({ type: "proxyWsClose", channelId: this.channelId, code: 1002, reason: `upstream handshake failed: ${statusLine}` });
          socket.destroy();
          return;
        }
        this.handshook = true;
        this.send({ type: "proxyWsOpen", channelId: this.channelId });
        const rest = head.subarray(end + 4);
        if (rest.length) this.relay(rest);
        head = Buffer.alloc(0);
        return;
      }
      this.relay(chunk);
    };
    socket.on("data", onData);
    socket.on("error", () => this.send({ type: "proxyWsClose", channelId: this.channelId, code: 1006 }));
    socket.on("close", () => this.send({ type: "proxyWsClose", channelId: this.channelId, code: 1000 }));
  }

  /** Raw bytes after the handshake — frames flow untouched in both
   *  directions (the browser↔server WS already frames them). */
  private relay(chunk: Buffer) {
    this.leftover = Buffer.concat([this.leftover, chunk]);
    this.send({ type: "proxyWsData", channelId: this.channelId, dataBase64: this.leftover.toString("base64") });
    this.leftover = Buffer.alloc(0);
  }

  /** Browser → upstream bytes. */
  write(dataBase64: string) {
    this.socket?.write(Buffer.from(dataBase64, "base64"));
  }

  close() {
    this.socket?.destroy();
    this.socket = null;
  }
}
