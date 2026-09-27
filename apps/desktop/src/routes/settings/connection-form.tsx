import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { api } from "../../lib/api";
import type { LlmConnection, LlmProvider } from "../../lib/llm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConnectionFormProps {
  providers: LlmProvider[];
  connection?: LlmConnection;
  onSaved: () => void;
  onCancel: () => void;
}

export function ConnectionForm({ providers, connection, onSaved, onCancel }: ConnectionFormProps) {
  const editing = !!connection;
  const [providerId, setProviderId] = useState(connection?.provider ?? providers[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const provider = providers.find((p) => p.id === providerId);

  const form = useForm({
    defaultValues: {
      name: connection?.name ?? "",
      config: (connection?.config ?? {}) as Record<string, string>,
    },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        if (editing) {
          await api(`/api/llm/connections/${connection.id}`, {
            method: "PATCH",
            body: JSON.stringify({ name: value.name, config: value.config }),
          });
        } else {
          await api("/api/llm/connections", {
            method: "POST",
            body: JSON.stringify({
              provider: providerId,
              name: value.name,
              config: value.config,
            }),
          });
        }
        onSaved();
      } catch (e) {
        setError((e as Error).message);
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {!editing && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="provider">Provider</Label>
          <select
            id="provider"
            className="border-input bg-background rounded-md border px-3 py-2 text-sm shadow-xs focus:border-ring focus:ring-ring/50 focus:outline-none"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <form.Field name="name">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="conn-name">Name</Label>
            <Input
              id="conn-name"
              placeholder="e.g. Work Kimi"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              required
            />
          </div>
        )}
      </form.Field>

      {provider?.fields.map((providerField) => (
        <form.Field key={providerField.key} name={`config.${providerField.key}`}>
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`conn-${providerField.key}`}>
                {providerField.label}
                {providerField.optional && <span className="text-muted-foreground font-normal"> (optional)</span>}
              </Label>
              <Input
                id={`conn-${providerField.key}`}
                type={providerField.secret ? "password" : "text"}
                placeholder={providerField.placeholder}
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                required={!providerField.optional}
              />
            </div>
          )}
        </form.Field>
      ))}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {editing ? "Save" : "Add"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
