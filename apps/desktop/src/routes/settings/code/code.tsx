import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SettingsCode, type SkillSources, type TerminalScope } from "@/components/blocks/settings/code/settings-code";

interface CodeSettings {
  terminalScope: TerminalScope;
  systemPrompt: string;
  systemPromptIsDefault: boolean;
  skillSources: SkillSources;
}

export function CodeSection() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["code", "settings"],
    queryFn: () => api<CodeSettings>("/api/code/settings"),
  });

  // null = pristine — the editor always shows the effective prompt.
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => {
    setDraft(null);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (patch: Partial<{ terminalScope: TerminalScope; skillSources: SkillSources; systemPrompt: string | null }>) =>
      api<CodeSettings>("/api/code/settings", { method: "PUT", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["code", "settings"] }),
  });

  const saved = settings.data?.systemPrompt ?? "";
  const isDefault = settings.data?.systemPromptIsDefault ?? true;
  const dirty = draft !== null && draft !== saved;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <SettingsCode
        loading={settings.isPending}
        saving={save.isPending}
        terminalScope={settings.data?.terminalScope}
        onTerminalScopeChange={(terminalScope) => save.mutate({ terminalScope })}
        skillSources={settings.data?.skillSources}
        onSkillSourcesChange={(skillSources) => save.mutate({ skillSources })}
        systemPrompt={draft ?? saved}
        onSystemPromptChange={setDraft}
        systemPromptIsDefault={isDefault}
        systemPromptDirty={dirty}
        onSystemPromptSave={() => save.mutate({ systemPrompt: draft ?? "" })}
        // A stored override is cleared server-side; an unsaved edit is simply discarded.
        onSystemPromptReset={() => (isDefault ? setDraft(null) : save.mutate({ systemPrompt: null }))}
      />
    </div>
  );
}
