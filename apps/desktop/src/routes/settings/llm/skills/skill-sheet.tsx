import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Skill } from "../use-workspace";
import { EditorSheet } from "../editor-sheet";
import { TagInput } from "../tag-input";
import { Label } from "@/components/ui/label";

export const SKILLS_LIST_PATH = "/apps/settings/llm/skills";

const NEW_SKILL_TEMPLATE = `---
title:
description:
---

`;

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function parseFrontmatter(content: string): { title?: string; description?: string } {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return {};
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (field) fields[field[1]] = field[2].trim().replace(/^["']|["']$/g, "");
  }
  return { title: fields.title, description: fields.description };
}

/** Skill files carry title/description in YAML frontmatter; legacy rows get it prepended from their columns. */
function withFrontmatter(skill: Skill): string {
  if (FRONTMATTER_RE.test(skill.content)) return skill.content;
  return `---\ntitle: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.content}`;
}

export function SkillSheet() {
  const { skillId } = useParams();
  const navigate = useNavigate();
  const close = () => navigate(SKILLS_LIST_PATH);

  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["workspace", "skills"], queryFn: () => api<Skill[]>("/api/skills") });
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["workspace", "skills"] });
    void queryClient.invalidateQueries({ queryKey: ["workspace", "llm-tags"] });
  };
  const save = useMutation({
    mutationFn: (input: { id: string; isNew: boolean; name: string; description: string; content: string; tags: string[] }) =>
      api<Skill>(input.isNew ? "/api/skills" : `/api/skills/${input.id}`, {
        method: input.isNew ? "POST" : "PATCH",
        body: JSON.stringify({ id: input.id, name: input.name, description: input.description, content: input.content, tags: input.tags }),
      }),
    onSuccess: invalidate,
  });

  const existing = skillId ? list.data?.find((s) => s.id === skillId) : undefined;
  const isNew = Boolean(skillId) && list.isSuccess && !existing;

  const initialValue = useMemo(() => {
    if (!skillId || !list.isSuccess) return "";
    return existing ? withFrontmatter(existing) : NEW_SKILL_TEMPLATE;
  }, [skillId, list.isSuccess, existing]); // eslint-disable-line react-hooks/exhaustive-deps

  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTags(existing?.tags ?? []);
    setError(null);
  }, [existing]); // eslint-disable-line react-hooks/exhaustive-deps

  const liveTitle = parseFrontmatter(initialValue).title?.trim();

  const submit = (content: string) => {
    if (!skillId) return;
    const frontmatter = parseFrontmatter(content);
    if (!frontmatter.title?.trim() || !frontmatter.description?.trim()) {
      setError("Add both title and description to the frontmatter");
      return;
    }
    if (!content.replace(FRONTMATTER_RE, "").trim()) {
      setError("Skill content is required");
      return;
    }
    save.mutate(
      { id: skillId, isNew, name: frontmatter.title.trim(), description: frontmatter.description.trim(), content, tags },
      { onSuccess: close, onError: (e) => setError((e as Error).message) },
    );
  };

  const fieldsDirty = existing ? JSON.stringify(tags) !== JSON.stringify(existing.tags) : tags.length > 0;

  return (
    <EditorSheet
      docKey={existing ? existing.id : (skillId ?? null)}
      open={Boolean(skillId)}
      loading={Boolean(skillId) && list.isPending}
      title={liveTitle || (isNew ? "New skill" : "Edit skill")}
      initialValue={initialValue}
      placeholder="Skill instructions…"
      ariaLabel="Skill content"
      error={error}
      savePending={save.isPending}
      submitLabel={isNew ? "Create skill" : "Save changes"}
      onSubmit={submit}
      onClose={close}
      fieldsDirty={fieldsDirty}
      fields={
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="skill-tags" className="text-muted-foreground text-xs">
            Tags
          </Label>
          <TagInput id="skill-tags" value={tags} onChange={setTags} placeholder="convention, db" />
        </div>
      }
    />
  );
}
