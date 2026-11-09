import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api } from "@/lib/api";
import { SettingsInstagramSession } from "@/components/blocks/settings/shared-content/settings-instagram-session";
import { SettingsShareTargets, type ShareTargets } from "@/components/blocks/settings/shared-content/settings-share-targets";
import { SettingsSharedDatabases } from "@/components/blocks/settings/shared-content/settings-shared-databases";
import type { SharedContentSettings } from "../../share/use-share";

/** Settings → Shared Content: manage locked shared_content databases and
 *  choose which database shared links (and Instagram links) land in. */
export function SharedContentSection() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const settings = useQuery({
    queryKey: ["shared-content"],
    queryFn: () => api<SharedContentSettings>("/api/shared-content"),
  });

  const [draft, setDraft] = useState<ShareTargets | null>(null);
  const saved = settings.data?.targets ?? { default: null, instagram: null };
  // The draft falls back to the server values until the user touches a select.
  const targets = draft ?? saved;

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["shared-content"] });

  const createDatabase = useMutation({
    mutationFn: (title: string) => api("/api/shared-content/databases", { method: "POST", body: JSON.stringify({ title }) }),
    onSuccess: invalidate,
  });

  const saveTargets = useMutation({
    mutationFn: (t: ShareTargets) => api("/api/shared-content/targets", { method: "PUT", body: JSON.stringify(t) }),
    onSuccess: () => {
      setDraft(null);
      invalidate();
    },
  });

  const saveInstagram = useMutation({
    mutationFn: (sessionId: string) => api("/api/shared-content/instagram", { method: "PUT", body: JSON.stringify({ sessionId }) }),
    onSuccess: invalidate,
  });

  const databases = (settings.data?.databases ?? []).filter((d) => !d.deletedAt).map((d) => ({ id: d.id, title: d.title }));

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <SettingsSharedDatabases
        databases={databases}
        loading={settings.isPending}
        onOpen={() => navigate("/apps/notes/databases")}
        onCreate={(title) => createDatabase.mutate(title)}
        creating={createDatabase.isPending}
        error={createDatabase.isError ? createDatabase.error.message : null}
      />
      <SettingsShareTargets
        databases={databases}
        targets={targets}
        onTargetsChange={setDraft}
        dirty={draft !== null}
        onSave={() => saveTargets.mutate(targets)}
        saving={saveTargets.isPending}
        error={saveTargets.isError ? saveTargets.error.message : null}
      />
      <SettingsInstagramSession
        configured={settings.data?.instagram.sessionIdConfigured ?? false}
        masked={settings.data?.instagram.sessionIdMasked ?? null}
        onSave={(sessionId) => saveInstagram.mutate(sessionId)}
        saving={saveInstagram.isPending}
        error={saveInstagram.isError ? saveInstagram.error.message : null}
      />
    </div>
  );
}
