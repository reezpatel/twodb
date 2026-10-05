import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { McpServer } from "../use-workspace";
import { Empty, PanelShell, ResourceTable } from "../workspace-panels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { McpSheet, MCP_LIST_PATH } from "./mcp-sheet";

interface ImportPreview {
  drafts: { name: string; url: string; transport: string; headers: Record<string, string> }[];
  skipped: { name: string; reason: string }[];
}

export function McpSection() {
  const { mcpId } = useParams();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["workspace", "mcp"] });
  const list = useQuery({ queryKey: ["workspace", "mcp"], queryFn: () => api<McpServer[]>("/api/mcp") });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/mcp/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const previewPending = useMutation({
    mutationFn: (json: string) => api<ImportPreview>("/api/mcp/import/preview", { method: "POST", body: JSON.stringify({ json }) }),
    onSuccess: (data) => {
      setPreview(data);
      setImportError(null);
    },
    onError: (e) => {
      setPreview(null);
      setImportError((e as Error).message);
    },
  });
  const runImport = useMutation({
    mutationFn: (json: string) => api<{ created: McpServer[]; conflicts: string[]; skipped: { name: string; reason: string }[] }>("/api/mcp/import", { method: "POST", body: JSON.stringify({ json }) }),
    onSuccess: () => {
      invalidate();
      setImportOpen(false);
      setImportJson("");
      setPreview(null);
      setImportError(null);
    },
    onError: (e) => setImportError((e as Error).message),
  });

  return (
    <div className="flex flex-col gap-4">
      <PanelShell
        title="MCP servers"
        hint="external tool servers offered to code-session agents as tool calls"
        onNew={() => navigate(`${MCP_LIST_PATH}/${crypto.randomUUID()}`)}
      >
        {list.isPending ? (
          <Empty pending label="MCP server" />
        ) : (
          <>
            <ResourceTable
              rows={(list.data ?? []).map((server) => ({
                id: server.id,
                name: (
                  <span className="flex items-center gap-2">
                    <span className="truncate">{server.name}</span>
                    {!server.enabled && <span className="text-muted-foreground text-[10px] uppercase">disabled</span>}
                  </span>
                ),
                subtitle: <span className="line-clamp-1">{server.url}</span>,
                tags: server.tags,
                codeDirectoryId: server.codeDirectoryId,
              }))}
              onEdit={(id) => navigate(`${MCP_LIST_PATH}/${id}`)}
              onDelete={(id) => remove.mutate(id, { onSuccess: () => mcpId === id && navigate(MCP_LIST_PATH) })}
              deletePending={remove.isPending}
            />
            {(list.data ?? []).length === 0 && (
              <Card>
                <CardContent className="p-6">
                  <p className="text-muted-foreground text-sm">
                    No MCP servers yet. Add one, or paste an mcpServers JSON config (VS Code / Claude Desktop format) to import.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </PanelShell>

      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-xs">
          Servers tagged <span className="font-mono">default</span> (or any session tag) load into matching code sessions; their tools appear as
          <span className="font-mono"> mcp__&lt;server&gt;__&lt;tool&gt;</span>.
        </p>
        <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
          Import mcpServers JSON
        </Button>
      </div>

      <McpSheet />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import MCP servers</DialogTitle>
            <DialogDescription>
              Paste an <span className="font-mono">{`{ "mcpServers": { … } }`}</span> config. http/sse servers are imported; stdio entries are skipped.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-48 font-mono text-xs"
            placeholder={`{\n  "mcpServers": {\n    "firecrawl": {\n      "type": "http",\n      "url": "https://mcp.firecrawl.dev/v2/mcp",\n      "headers": { "Authorization": "Bearer <FIRECRAWL_API_KEY>" }\n    }\n  }\n}`}
            value={importJson}
            onChange={(e) => {
              setImportJson(e.target.value);
              setPreview(null);
              setImportError(null);
            }}
          />
          {preview && (
            <div className="flex flex-col gap-1 text-xs">
              {preview.drafts.map((d) => (
                <p key={d.name} className="text-success">
                  ✓ {d.name} — {d.url}
                </p>
              ))}
              {preview.skipped.map((s) => (
                <p key={s.name} className="text-destructive">
                  ✗ {s.name} — {s.reason}
                </p>
              ))}
            </div>
          )}
          {importError && (
            <p className="text-destructive text-xs" role="alert">
              {importError}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" disabled={!importJson.trim() || previewPending.isPending} onClick={() => previewPending.mutate(importJson)}>
              {previewPending.isPending ? <Loader2 size={13} className="animate-spin" /> : null} Preview
            </Button>
            <Button size="sm" disabled={!preview?.drafts.length || runImport.isPending} onClick={() => runImport.mutate(importJson)}>
              {runImport.isPending ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
