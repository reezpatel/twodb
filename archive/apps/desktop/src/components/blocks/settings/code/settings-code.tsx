import type { ComponentProps } from "react";
import { Loader2, RotateCcw, SquareTerminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SettingsCard, SettingsCardHeader, SettingsCardRow, SettingsRowText } from "../settings-card";

export type TerminalScope = "runner" | "directory" | "session";

export interface SkillSources {
  agents: boolean;
  claude: boolean;
}

export const TERMINAL_SCOPES: { value: TerminalScope; label: string; hint: string }[] = [
  { value: "runner", label: "Per runner", hint: "One shared tmux session (twodb) — every code session on that runner attaches to the same terminal." },
  { value: "directory", label: "Per directory", hint: "Sessions in the same working directory share a terminal; different directories are independent." },
  { value: "session", label: "Per code session", hint: "Each code session gets its own terminal — fully independent shells." },
];

const SKILL_SOURCES: { key: keyof SkillSources; label: string; hint: string }[] = [
  { key: "agents", label: ".agents/skills", hint: "codex-style skills — enabled by default" },
  { key: "claude", label: ".claude/skills", hint: "claude-style skills — off by default" },
];

export interface SettingsCodeProps extends Omit<ComponentProps<typeof SettingsCard>, "onChange"> {
  /** First load in flight — controls are disabled. */
  loading?: boolean;
  /** A save is in flight — controls are disabled. */
  saving?: boolean;

  terminalScope: TerminalScope | undefined;
  onTerminalScopeChange: (scope: TerminalScope) => void;

  skillSources: SkillSources | undefined;
  onSkillSourcesChange: (sources: SkillSources) => void;

  /** The prompt text shown in the editor (draft or saved). */
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  /** True when no override is stored — the shipped default is in use. */
  systemPromptIsDefault: boolean;
  /** True when the editor differs from what's saved. */
  systemPromptDirty: boolean;
  onSystemPromptSave: () => void;
  /** Clears the stored override, or discards an unsaved edit. */
  onSystemPromptReset: () => void;
}

/** Code-session preferences: terminal sharing, which repo skill folders to read, and the agent system prompt. Controlled. */
export function SettingsCode({
  loading,
  saving,
  terminalScope,
  onTerminalScopeChange,
  skillSources,
  onSkillSourcesChange,
  systemPrompt,
  onSystemPromptChange,
  systemPromptIsDefault,
  systemPromptDirty,
  onSystemPromptSave,
  onSystemPromptReset,
  className,
  ...props
}: SettingsCodeProps) {
  const disabled = loading || saving;

  return (
    <SettingsCard data-slot="settings-code" className={className} {...props}>
      <SettingsCardHeader icon={SquareTerminal} title="Code" />

      <SettingsCardRow divider className="flex items-center justify-between gap-4">
        <SettingsRowText
          title="Terminal sharing"
          description={
            TERMINAL_SCOPES.find((scope) => scope.value === terminalScope)?.hint ??
            "Terminals run inside a persistent tmux session on the runner — closing a tab detaches instead of killing it."
          }
          htmlFor="code-terminal-scope"
        />
        <Select value={terminalScope ?? ""} onValueChange={(value) => onTerminalScopeChange(value as TerminalScope)} disabled={disabled}>
          <SelectTrigger id="code-terminal-scope" className="w-44">
            <SelectValue placeholder="…" />
          </SelectTrigger>
          <SelectContent>
            {TERMINAL_SCOPES.map((scope) => (
              <SelectItem key={scope.value} value={scope.value}>
                {scope.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsCardRow>

      {SKILL_SOURCES.map((source) => (
        <SettingsCardRow key={source.key} divider className="flex items-center justify-between gap-4">
          <SettingsRowText title={`Read ${source.label}`} description={source.hint} htmlFor={`code-skills-${source.key}`} />
          <Switch
            id={`code-skills-${source.key}`}
            checked={skillSources?.[source.key] ?? false}
            onCheckedChange={(checked) => skillSources && onSkillSourcesChange({ ...skillSources, [source.key]: checked })}
            disabled={disabled || !skillSources}
          />
        </SettingsCardRow>
      ))}

      <SettingsCardRow className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <SettingsRowText
            title="Agent system prompt"
            description="Sent at the start of every code-session round — the session's working directory is appended automatically."
            htmlFor="code-system-prompt"
          />
          <span className="bg-foreground/6 text-muted-foreground shrink-0 rounded-md px-1.5 py-px text-xs leading-5">
            {systemPromptIsDefault ? "default" : "customized"}
          </span>
        </div>
        <Textarea
          id="code-system-prompt"
          value={systemPrompt}
          onChange={(event) => onSystemPromptChange(event.target.value)}
          disabled={disabled}
          spellCheck={false}
          className="min-h-72 font-mono text-xs leading-relaxed"
        />
        <div className="flex items-center gap-2">
          {systemPromptDirty ? <span className="text-muted-foreground/70 text-xs">Unsaved changes</span> : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={onSystemPromptReset}
            disabled={disabled || (systemPromptIsDefault && !systemPromptDirty)}
          >
            <RotateCcw data-icon="inline-start" /> Reset to default
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onSystemPromptSave} disabled={disabled || !systemPromptDirty}>
            {saving ? <Loader2 className="animate-spin" /> : null} Save
          </Button>
        </div>
      </SettingsCardRow>
    </SettingsCard>
  );
}
