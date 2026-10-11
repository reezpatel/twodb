import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { AtSign, ChevronDown, Loader2, Mail, Server } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ConnectorField, ConnectorPreset, EmailMeta } from "../../email/email-api";
import { useAddImapAccount } from "./use-email-settings";

const PRESET_ICON: Record<string, typeof Mail> = { gmail: Mail, yahoo: AtSign, custom: Server };

function ImapForm({ preset, fields, onDone }: { preset: ConnectorPreset; fields: ConnectorField[]; onDone: () => void }) {
  const add = useAddImapAccount(onDone);
  const [advanced, setAdvanced] = useState(preset.id === "custom");
  const configFields = fields.filter((f) => !f.secret && f.key !== "username");
  const form = useForm({
    defaultValues: {
      address: "",
      displayName: "",
      password: "",
      username: "",
      config: Object.fromEntries(configFields.map((f) => [f.key, preset.defaults[f.key] ?? (f.type === "boolean" ? false : "")])) as Record<string, string | number | boolean>,
    },
    onSubmit: async ({ value }) => {
      await add.mutateAsync({
        preset: preset.id,
        address: value.address.trim(),
        displayName: value.displayName.trim(),
        password: value.password,
        config: { ...value.config, ...(value.username.trim() ? { username: value.username.trim() } : {}) },
      });
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      {preset.help ? (
        <Alert>
          <AlertDescription className="text-xs">{preset.help}</AlertDescription>
        </Alert>
      ) : null}
      {add.error ? (
        <p className="text-destructive text-sm" role="alert">
          {add.error.message}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <form.Field name="address" validators={{ onSubmit: ({ value }) => (/^[^@\s]+@[^@\s]+$/.test(value.trim()) ? undefined : "Enter a valid address") }}>
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="acc-address">Email address</Label>
              <Input id="acc-address" type="email" placeholder="you@yahoo.com" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
              {field.state.meta.errors[0] ? <span className="text-destructive text-xs">{String(field.state.meta.errors[0])}</span> : null}
            </div>
          )}
        </form.Field>
        <form.Field name="displayName">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="acc-name">Display name</Label>
              <Input id="acc-name" placeholder="Alex White" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
            </div>
          )}
        </form.Field>
      </div>
      <form.Field name="password" validators={{ onSubmit: ({ value }) => (value ? undefined : "Required") }}>
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="acc-password">{preset.id === "yahoo" ? "App password" : "Password / app password"}</Label>
            <Input id="acc-password" type="password" autoComplete="new-password" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
            {field.state.meta.errors[0] ? <span className="text-destructive text-xs">{String(field.state.meta.errors[0])}</span> : null}
          </div>
        )}
      </form.Field>

      <button type="button" className="text-muted-foreground hover:text-foreground flex items-center gap-1 self-start text-xs" onClick={() => setAdvanced((v) => !v)}>
        <ChevronDown size={13} className={cn("transition-transform", advanced && "rotate-180")} /> Server settings
      </button>
      {advanced ? (
        <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
          <form.Field name="username">
            {(field) => (
              <div className="col-span-2 flex flex-col gap-2">
                <Label htmlFor="acc-username">Username</Label>
                <Input id="acc-username" placeholder="defaults to the email address" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
              </div>
            )}
          </form.Field>
          {configFields.map((f) => (
            <form.Field key={f.key} name={`config.${f.key}`}>
              {(field) =>
                f.type === "boolean" ? (
                  <label className="flex items-center justify-between gap-2 text-sm">
                    {f.label}
                    <Switch checked={!!field.state.value} onCheckedChange={(v) => field.handleChange(v)} />
                  </label>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`acc-${f.key}`}>{f.label}</Label>
                    <Input
                      id={`acc-${f.key}`}
                      type={f.type === "number" ? "number" : "text"}
                      value={String(field.state.value ?? "")}
                      onChange={(e) => field.handleChange(f.type === "number" ? Number(e.target.value) : e.target.value)}
                    />
                  </div>
                )
              }
            </form.Field>
          ))}
        </div>
      ) : null}

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(submitting) => (
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            {submitting ? "Verifying connection…" : "Connect account"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

export function AddAccountDialog({
  open,
  onOpenChange,
  meta,
  onGmail,
  gmailPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meta: EmailMeta;
  onGmail: () => void;
  gmailPending: boolean;
}) {
  const [presetId, setPresetId] = useState<string | null>(null);
  const preset = meta.presets.find((p) => p.id === presetId) ?? null;
  const close = (v: boolean) => {
    if (!v) setPresetId(null);
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{preset ? `Connect ${preset.label}` : "Add email account"}</DialogTitle>
          <DialogDescription>Mail is synced into twodb and stored locally — the provider is only used to fetch new mail and send.</DialogDescription>
        </DialogHeader>
        {!preset ? (
          <div className="flex flex-col gap-2">
            {meta.presets.map((p) => {
              const Icon = PRESET_ICON[p.id] ?? Mail;
              const disabled = p.kind === "gmail" && !meta.gmail.configured;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setPresetId(p.id)}
                  className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="bg-muted grid size-9 shrink-0 place-items-center rounded-md">
                    <Icon size={16} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <strong className="text-sm font-medium">{p.label}</strong>
                    <span className="text-muted-foreground text-xs">
                      {disabled ? "An administrator must configure the Google OAuth client below first." : p.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : preset.kind === "gmail" ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              You'll be sent to Google to grant read and send access. twodb never changes or deletes anything in your Gmail.
            </p>
            <Button onClick={onGmail} disabled={gmailPending}>
              {gmailPending ? <Loader2 className="animate-spin" /> : <Mail />} Sign in with Google
            </Button>
            <Button variant="ghost" onClick={() => setPresetId(null)}>
              Back
            </Button>
          </div>
        ) : (
          <ImapForm key={preset.id} preset={preset} fields={meta.imapFields} onDone={() => close(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
