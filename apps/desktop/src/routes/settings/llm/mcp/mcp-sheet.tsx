import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlugZap } from "lucide-react";
import { api } from "@/lib/api";
import type { McpServer } from "../use-workspace";
import { TagInput } from "../tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

export const MCP_LIST_PATH = "/apps/settings/llm/mcp";

const TRANSPORTS = [
  { value: "auto", label: "Auto (streamable http → sse)" },
  { value: "http", label: "Streamable HTTP" },
  { value: "sse", label: "SSE (legacy)" },
];

interface TestResult {
  ok: boolean;
  ms?: number;
  tools?: { name: string; description?: string }[];
  error?: string;
}

export function McpSheet() {
  const { mcpId } = useParams();
  const navigate = useNavigate();
  const close = () => navigate(MCP_LIST_PATH);

  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["workspace", "mcp"] });
    void queryClient.invalidateQueries({ queryKey: ["workspace", "llm-tags"] });
  };
  const list = useQuery({ queryKey: ["workspace", "mcp"], queryFn: () => api<McpServer[]>("/api/mcp") });

  const save = useMutation({
    mutationFn: (input: { id: string; isNew: boolean; body: Record<string, unknown> }) =>
      api<McpServer>(input.isNew ? "/api/mcp" : `/api/mcp/${input.id}`, { method: input.isNew ? "POST" : "PATCH", body: JSON.stringify(input.body) }),
    onSuccess: invalidate,
  });
  const test = useMutation({
    mutationFn: (id: string) => api<TestResult>(`/api/mcp/${id}/tools`, { method: "POST" }),
  });

  const existing = mcpId ? list.data?.find((s) => s.id === mcpId) : undefined;
  const isNew = Boolean(mcpId) && list.isSuccess && !existing;

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [transport, setTransport] = useState("auto");
  const [headersJson, setHeadersJson] = useState("{}");
  const [enabled, setEnabled] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    setName(existing?.name ?? "");
    setUrl(existing?.url ?? "");
    setTransport(existing?.transport ?? "auto");
    setHeadersJson(existing ? JSON.stringify(existing.headers ?? {}, null, 2) : "{}");
    setEnabled(existing?.enabled ?? true);
    // New servers default to the universal tag — empty tags match no session.
    setTags(existing?.tags?.length ? existing.tags : ["default"]);
    setError(null);
    setTestResult(null);
  }, [existing]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (!mcpId) return;
    if (!/^[\w][\w-]*$/.test(name.trim())) {
      setError("Name must be letters, digits, dashes or underscores");
      return;
    }
    let headers: Record<string, string>;
    try {
      const parsed = JSON.parse(headersJson || "{}") as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
      headers = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v !== "string") throw new Error(`header "${k}" must be a string`);
        headers[k] = v;
      }
    } catch (e) {
      setError(`Headers: ${(e as Error).message}`);
      return;
    }
    if (!url.trim()) {
      setError("URL is required");
      return;
    }
    const body: Record<string, unknown> = { name: name.trim(), url: url.trim(), transport, headers, enabled, tags };
    save.mutate(
      { id: mcpId, isNew, body },
      {
        onSuccess: () => close(),
        onError: (e) => setError((e as Error).message),
      },
    );
  };

  const runTest = () => {
    if (!existing) return;
    setTestResult(null);
    test.mutate(existing.id, { onSuccess: setTestResult, onError: (e) => setTestResult({ ok: false, error: (e as Error).message }) });
  };

  return (
    <Sheet open={Boolean(mcpId)} onOpenChange={(next) => !next && close()}>
      <SheetContent side="right" className="w-full gap-4 overflow-y-auto p-0 sm:max-w-[50%]">
        {(Boolean(mcpId) && list.isPending) || save.isPending ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="text-muted-foreground animate-spin" size={18} />
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-6 py-8">
            <SheetHeader className="p-0 text-left">
              <SheetTitle>{isNew ? "New MCP server" : "Edit MCP server"}</SheetTitle>
              <SheetDescription>
                Remote MCP endpoint — its tools become agent tool calls in code sessions that match this server's scope and tags.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mcp-name" className="text-muted-foreground text-xs">
                Name
              </Label>
              <Input id="mcp-name" className="h-8 text-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="firecrawl" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mcp-url" className="text-muted-foreground text-xs">
                URL
              </Label>
              <Input id="mcp-url" className="h-8 font-mono text-xs" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.firecrawl.dev/v2/mcp" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-muted-foreground text-xs">Transport</Label>
              <Select value={transport} onValueChange={setTransport}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSPORTS.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mcp-headers" className="text-muted-foreground text-xs">
                Headers (JSON — <span className="font-mono">{"<ENV_NAME>"}</span> placeholders resolve from the server environment)
              </Label>
              <textarea
                id="mcp-headers"
                aria-label="Headers JSON"
                className="bg-background font-mono text-xs rounded-lg border p-2 outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={5}
                value={headersJson}
                onChange={(e) => setHeadersJson(e.target.value)}
                placeholder={'{\n  "Authorization": "Bearer <FIRECRAWL_API_KEY>"\n}'}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="mcp-enabled" className="text-muted-foreground text-xs">
                Enabled
              </Label>
              <Switch id="mcp-enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mcp-tags" className="text-muted-foreground text-xs">
                Tags
              </Label>
              <TagInput id="mcp-tags" value={tags} onChange={setTags} placeholder="default" />
            </div>

            {error && (
              <p className="text-destructive text-xs" role="alert">
                {error}
              </p>
            )}

            {existing && (
              <div className="flex flex-col gap-2">
                <Button variant="secondary" size="sm" className="w-fit" disabled={test.isPending} onClick={runTest}>
                  {test.isPending ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
                  Test connection
                </Button>
                {testResult && (
                  <div className="rounded-lg border p-2 text-xs">
                    {testResult.ok ? (
                      <>
                        <p className="text-success">
                          ✓ connected in {testResult.ms}ms — {testResult.tools?.length ?? 0} tools
                        </p>
                        {testResult.tools?.slice(0, 10).map((t) => (
                          <p key={t.name} className="text-muted-foreground truncate font-mono">
                            mcp__{existing.name}__{t.name}
                          </p>
                        ))}
                        {(testResult.tools?.length ?? 0) > 10 && (
                          <p className="text-muted-foreground">…and {(testResult.tools?.length ?? 0) - 10} more</p>
                        )}
                      </>
                    ) : (
                      <p className="text-destructive">✗ {testResult.error}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto flex justify-end gap-2 pt-4">
              <Button variant="ghost" size="sm" onClick={close}>
                Cancel
              </Button>
              <Button size="sm" disabled={save.isPending} onClick={submit}>
                {save.isPending ? "Saving…" : isNew ? "Create server" : "Save changes"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
