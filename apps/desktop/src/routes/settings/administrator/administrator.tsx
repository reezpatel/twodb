import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SettingsAdministrator } from "@/components/blocks/settings/administrator/settings-administrator";

interface ServerSettings {
  signUpEnabled: boolean;
}

export function AdministratorSection() {
  const queryClient = useQueryClient();

  const settings = useQuery({
    queryKey: ["server-settings"],
    queryFn: () => api<ServerSettings>("/api/server-settings"),
  });

  const update = useMutation({
    mutationFn: (signUpEnabled: boolean) => api<ServerSettings>("/api/server-settings", { method: "PUT", body: JSON.stringify({ signUpEnabled }) }),
    onSuccess: (row) => void queryClient.setQueryData(["server-settings"], row),
  });

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <SettingsAdministrator
        signUpEnabled={settings.data?.signUpEnabled ?? true}
        onSignUpEnabledChange={(enabled) => update.mutate(enabled)}
        loading={settings.isPending}
        saving={update.isPending}
        error={settings.isError ? "Not available — requires an admin account." : null}
      />
    </div>
  );
}
