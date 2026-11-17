/**
 * Smoke test for the toolkit MCP client (src/mcp-client.ts). Spins up a local
 * mock MCP server (streamable-HTTP: initialize + tools/list + tools/call),
 * points a fake McpServerRow at it, and verifies list + call. Run:
 *   node_modules/.bin/tsx scripts/smoke-mcp.ts
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { listMcpTools, callMcpTool, parseMcpToolName, type McpServerRowLike } from "../src/mcp-client.js";

function startMockMcp(): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const msg = body ? (JSON.parse(body) as { id?: number; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } }) : {};
      const reply = (result: unknown) => {
        res.setHeader("content-type", "application/json");
        res.setHeader("mcp-session-id", "sess-123");
        res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id ?? null, result }));
      };
      if (msg.method === "initialize") {
        return reply({ protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "mock", version: "0" } });
      }
      if (msg.method === "tools/list") {
        return reply({
          tools: [
            {
              name: "create_issue",
              description: "Create a Linear issue",
              inputSchema: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Issue title" },
                  priority: { type: "integer", description: "0-4" },
                  team: { type: "string", enum: ["eng", "design"], description: "Team" },
                },
                required: ["title"],
              },
            },
            { name: "ping", description: "Ping the server", inputSchema: { type: "object", properties: {} } },
          ],
        });
      }
      if (msg.method === "tools/call") {
        const args = msg.params?.arguments ?? {};
        return reply({ content: [{ type: "text", text: JSON.stringify({ ok: true, called: msg.params?.name, args }) }] });
      }
      // notifications/initialized etc.
      res.statusCode = 202;
      res.end();
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}/mcp` });
    });
  });
}

const row = (url: string): McpServerRowLike => ({
  id: "srv1",
  workspace_id: "w1",
  name: "Linear",
  url,
  transport: "auto",
  headers_json: JSON.stringify({ authorization: "Bearer <TEST_LINEAR_KEY>" }),
  enabled: 1,
  scope_mode: "all",
  scope_all: 1,
  scope_ids_json: "[]",
  agent_ids_json: "[]",
  created_at: "",
  updated_at: "",
});

process.env.TEST_LINEAR_KEY = "secret-token";

const { server, url } = await startMockMcp();
try {
  const r = row(url);
  const tools = await listMcpTools(r);
  console.log("LIST →", JSON.stringify(tools, null, 2));

  const create = tools.find((t) => t.name === "mcp__linear__create_issue");
  if (!create) throw new Error("expected mcp__linear__create_issue in list");
  if (create.params.title?.required !== true) throw new Error("title should be required");
  if (create.params.priority?.type !== "number") throw new Error("priority should map to number");
  if (create.params.team?.type !== "enum" || create.params.team?.options?.join(",") !== "eng,design") throw new Error("team should be enum eng,design");

  const out = await callMcpTool(r, "create_issue", { title: "Test", priority: 2 });
  console.log("CALL →", JSON.stringify(out));
  if ((out as { called?: string }).called !== "create_issue") throw new Error("call did not reach server");

  const parsed = parseMcpToolName("mcp__linear__create_issue");
  console.log("PARSE →", JSON.stringify(parsed));
  if (parsed?.serverSlug !== "linear" || parsed.tool !== "create_issue") throw new Error("name parse wrong");

  console.log("\nOK — MCP client lists + calls + maps params correctly");
} finally {
  server.close();
}

