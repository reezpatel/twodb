import { useState } from "react";
import { Loader2 } from "lucide-react";
import { RunnerTerminal } from "./runner-terminal";
import { useRunners } from "./use-runners";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function RunnersSection() {
  const { runners, keys, newKey, setNewKey, terminalRunner, setTerminalRunner, actionError, createKey, revokeKey, deleteRunner } = useRunners();

  const [keyName, setKeyName] = useState("");

  if (terminalRunner) {
    return <RunnerTerminal runnerId={terminalRunner.id} runnerName={terminalRunner.name} onClose={() => setTerminalRunner(null)} />;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {actionError && (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Access keys</CardTitle>
          <CardDescription>One key can connect many runners to this organization.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {newKey && (
            <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
              <p className="text-success">Key created — copy it now, it won't be shown again:</p>
              <code className="bg-muted mt-2 block w-full rounded p-2 break-all select-all">{newKey}</code>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setNewKey(null)}>
                Dismiss
              </Button>
            </div>
          )}

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              createKey.mutate(keyName);
              setKeyName("");
            }}
          >
            <Input className="grow" placeholder="Key name" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
            <Button type="submit" size="sm" disabled={createKey.isPending}>
              Create key
            </Button>
          </form>

          {keys.data && keys.data.length > 0 && (
            <ul className="flex flex-col gap-1">
              {keys.data.map((k) => (
                <li key={k.id} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{k.name}</span>
                  <code className="text-muted-foreground">{k.prefix}…</code>
                  {k.revokedAt ? (
                    <Badge variant="secondary" className="ml-auto">
                      revoked
                    </Badge>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive ml-auto" onClick={() => revokeKey.mutate(k.id)}>
                      Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runners</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {runners.isPending ? (
            <div className="flex justify-center py-4">
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            </div>
          ) : runners.data && runners.data.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {runners.data.map((runner) => (
                <li key={runner.id} className="flex items-center gap-3">
                  <Badge variant={runner.online ? "success" : "secondary"}>{runner.online ? "online" : "offline"}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{runner.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {runner.hostname ?? "—"} · last seen {new Date(runner.lastSeenAt).toLocaleString()}
                    </div>
                  </div>
                  {runner.online && (
                    <Button variant="outline" size="sm" onClick={() => setTerminalRunner(runner)}>
                      Terminal
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (window.confirm(`Remove runner "${runner.name}"?`)) {
                        deleteRunner.mutate(runner.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No runners yet. Create an access key, then start a runner with it:</p>
          )}
          <code className="bg-muted block rounded-md p-2 text-xs">TWODB_RUNNER_KEY=&lt;key&gt; pnpm --filter @twodb/runner dev</code>
        </CardContent>
      </Card>
    </div>
  );
}
