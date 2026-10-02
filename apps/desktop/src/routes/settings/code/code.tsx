import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TerminalScope = "runner" | "directory" | "session";

const SCOPES: { value: TerminalScope; label: string; hint: string }[] = [
  { value: "runner", label: "Per runner", hint: "One shared tmux session (twodb) — every code session on that runner attaches to the same terminal." },
  { value: "directory", label: "Per directory", hint: "Sessions in the same working directory share a terminal; different directories are independent." },
  { value: "session", label: "Per code session", hint: "Each code session gets its own terminal — fully independent shells." },
];

export function CodeSection() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["code", "settings"],
    queryFn: () => api<{ terminalScope: TerminalScope }>("/api/code/settings"),
  });

  const save = useMutation({
    mutationFn: (terminalScope: TerminalScope) =>
      api<{ terminalScope: TerminalScope }>("/api/code/settings", { method: "PUT", body: JSON.stringify({ terminalScope }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["code", "settings"] }),
  });

  const current = settings.data?.terminalScope;

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Code</CardTitle>
        <CardDescription>terminal and code-session preferences</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Terminal sharing</p>
            <p className="text-muted-foreground text-xs">{SCOPES.find((s) => s.value === current)?.hint}</p>
          </div>
          <Select value={current ?? ""} onValueChange={(v) => save.mutate(v as TerminalScope)} disabled={settings.isPending || save.isPending}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="…" />
            </SelectTrigger>
            <SelectContent>
              {SCOPES.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground/70 text-[11px]">
          Terminals run inside a persistent tmux session on the runner — closing a tab detaches instead of killing it, and reopening picks up where you left
          off.
        </p>
      </CardContent>
    </Card>
  );
}
