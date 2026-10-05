import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type TerminalScope = "runner" | "directory" | "session";

type SkillSources = { agents: boolean; claude: boolean };

interface CodeSettings {
  terminalScope: TerminalScope;
  systemPrompt: string;
  systemPromptIsDefault: boolean;
  skillSources: SkillSources;
}

const SCOPES: { value: TerminalScope; label: string; hint: string }[] = [
  { value: "runner", label: "Per runner", hint: "One shared tmux session (twodb) — every code session on that runner attaches to the same terminal." },
  { value: "directory", label: "Per directory", hint: "Sessions in the same working directory share a terminal; different directories are independent." },
  { value: "session", label: "Per code session", hint: "Each code session gets its own terminal — fully independent shells." },
];

function SystemPromptCard() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["code", "settings"],
    queryFn: () => api<CodeSettings>("/api/code/settings"),
  });
  // null = pristine — the textarea always shows the effective prompt.
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setDraft(null);
  }, [settings.data]);

  const effective = draft ?? settings.data?.systemPrompt ?? "";
  const isDefault = settings.data?.systemPromptIsDefault ?? true;
  const dirty = draft !== null && draft !== settings.data?.systemPrompt;

  const save = useMutation({
    mutationFn: (systemPrompt: string | null) => api<CodeSettings>("/api/code/settings", { method: "PUT", body: JSON.stringify({ systemPrompt }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["code", "settings"] }),
  });

  const reset = () => {
    // Stored override → clear it server-side; unsaved edit → just discard it.
    if (!isDefault) save.mutate(null);
    else setDraft(null);
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Agent system prompt
          <Badge variant={isDefault ? "secondary" : "default"} className="text-[10px]">
            {isDefault ? "default" : "customized"}
          </Badge>
        </CardTitle>
        <CardDescription>sent at the start of every code-session round — the session's working directory is appended automatically</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          value={effective}
          onChange={(e) => setDraft(e.target.value)}
          disabled={settings.isPending || save.isPending}
          spellCheck={false}
          className="min-h-72 font-mono text-xs leading-relaxed"
          aria-label="Agent system prompt"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => save.mutate(draft ?? "")} disabled={!dirty || save.isPending}>
            <Save size={13} /> Save
          </Button>
          <Button size="sm" variant="outline" onClick={reset} disabled={(isDefault && !dirty) || save.isPending}>
            <RotateCcw size={13} /> Reset to default
          </Button>
          {dirty && <span className="text-muted-foreground text-xs">unsaved changes</span>}
        </div>
      </CardContent>
    </Card>
  );
}

const SKILL_SOURCE_ROWS: { key: keyof SkillSources; label: string; hint: string }[] = [
  { key: "agents", label: ".agents/skills", hint: "codex-style skills — enabled by default" },
  { key: "claude", label: ".claude/skills", hint: "claude-style skills — off by default" },
];

function RepoSkillsCard() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["code", "settings"],
    queryFn: () => api<CodeSettings>("/api/code/settings"),
  });

  const save = useMutation({
    mutationFn: (skillSources: SkillSources) => api<CodeSettings>("/api/code/settings", { method: "PUT", body: JSON.stringify({ skillSources }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["code", "settings"] }),
  });

  const current = settings.data?.skillSources;

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Repo skills</CardTitle>
        <CardDescription>skill folders read live from the session's runner — titles go into the system prompt, content loads on demand</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {SKILL_SOURCE_ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-muted-foreground text-xs">{row.hint}</p>
            </div>
            <Switch
              checked={current?.[row.key] ?? false}
              onCheckedChange={(checked) => current && save.mutate({ ...current, [row.key]: checked })}
              disabled={!current || save.isPending}
              aria-label={`Read ${row.label}`}
            />
          </div>
        ))}
        <p className="text-muted-foreground/70 text-[11px]">
          Repo skills are never stored in the database — every read goes to the runner's working directory.
        </p>
      </CardContent>
    </Card>
  );
}

export function CodeSection() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["code", "settings"],
    queryFn: () => api<CodeSettings>("/api/code/settings"),
  });

  const save = useMutation({
    mutationFn: (terminalScope: TerminalScope) => api<CodeSettings>("/api/code/settings", { method: "PUT", body: JSON.stringify({ terminalScope }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["code", "settings"] }),
  });

  const current = settings.data?.terminalScope;

  return (
    <div className="flex flex-col gap-6">
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
      <SystemPromptCard />
      <RepoSkillsCard />
    </div>
  );
}
