import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { AtSign, Calendar, ChevronDown, Cloud, Loader2, Mail, Server } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { AccountCapability, ConnectorField, ConnectorPreset, EmailMeta } from "../../email/email-api";
import { useAddPasswordAccount, type OAuthProvider } from "./use-accounts-settings";

const PRESET_ICON: Record<string, typeof Mail> = {
  google: Mail,
  microsoft: Mail,
  icloud: Cloud,
  fastmail: AtSign,
  yahoo: AtSign,
  nextcloud: Cloud,
  custom: Server,
};
const CAPABILITY_LABEL: Record<AccountCapability, { label: string; icon: typeof Mail }> = {
  mail: { label: "Mail", icon: Mail },
  calendar: { label: "Calendar", icon: Calendar },
};

function CapabilityPicker({
  available,
  value,
  onChange,
}: {
  available: AccountCapability[];
  value: AccountCapability[];
  onChange: (v: AccountCapability[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Use this account for</Label>
      <div className="flex gap-2">
        {available.map((c) => {
          const { label, icon: Icon } = CAPABILITY_LABEL[c];
          const checked = value.includes(c);
          return (
            <label
              key={c}
              className={cn("flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm", checked && "border-primary bg-primary/5")}
            >
              <Checkbox checked={checked} onCheckedChange={(v) => onChange(v ? [...new Set([...value, c])] : value.filter((x) => x !== c))} />
              <Icon size={14} /> {label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function PasswordForm({ preset, fields, onDone }: { preset: ConnectorPreset; fields: ConnectorField[]; onDone: () => void }) {
  const add = useAddPasswordAccount(onDone);
  const [advanced, setAdvanced] = useState(preset.id === "custom" || preset.id === "nextcloud");
  const configFields = fields.filter((f) => !f.secret && f.key !== "username");
  const form = useForm({
    defaultValues: {
      address: "",
      displayName: "",
      password: "",
      username: "",
      capabilities: preset.id === "nextcloud" ? (["calendar"] as AccountCapability[]) : preset.capabilities,
      config: Object.fromEntries(configFields.map((f) => [f.key, preset.defaults[f.key] ?? (f.type === "boolean" ? false : "")])) as Record<
        string,
        string | number | boolean
      >,
    },
    onSubmit: async ({ value }) => {
      const config = Object.fromEntries(
        Object.entries(value.config).filter(([k]) => {
          const field = configFields.find((f) => f.key === k);
          return !field?.capability || value.capabilities.includes(field.capability);
        }),
      );
      await add.mutateAsync({
        preset: preset.id,
        address: value.address.trim(),
        displayName: value.displayName.trim(),
        password: value.password,
        capabilities: value.capabilities,
        config: { ...config, ...(value.username.trim() ? { username: value.username.trim() } : {}) },
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
      <form.Field name="capabilities" validators={{ onSubmit: ({ value }) => (value.length ? undefined : "Pick at least one") }}>
        {(field) => (
          <div className="flex flex-col gap-1">
            <CapabilityPicker available={preset.capabilities} value={field.state.value} onChange={field.handleChange} />
            {field.state.meta.errors[0] ? <span className="text-destructive text-xs">{String(field.state.meta.errors[0])}</span> : null}
          </div>
        )}
      </form.Field>
      <div className="grid grid-cols-2 gap-3">
        <form.Field name="address" validators={{ onSubmit: ({ value }) => (/^[^@\s]+@[^@\s]+$/.test(value.trim()) ? undefined : "Enter a valid address") }}>
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="acc-address">Email address</Label>
              <Input
                id="acc-address"
                type="email"
                placeholder="you@example.com"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
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
            <Label htmlFor="acc-password">{preset.id === "custom" ? "Password / app password" : "App password"}</Label>
            <Input
              id="acc-password"
              type="password"
              autoComplete="new-password"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors[0] ? <span className="text-destructive text-xs">{String(field.state.meta.errors[0])}</span> : null}
          </div>
        )}
      </form.Field>

      <button
        type="button"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 self-start text-xs"
        onClick={() => setAdvanced((v) => !v)}
      >
        <ChevronDown size={13} className={cn("transition-transform", advanced && "rotate-180")} /> Server settings
      </button>
      {advanced ? (
        <form.Subscribe selector={(s) => s.values.capabilities}>
          {(caps) => (
            <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
              <form.Field name="username">
                {(field) => (
                  <div className="col-span-2 flex flex-col gap-2">
                    <Label htmlFor="acc-username">Username</Label>
                    <Input
                      id="acc-username"
                      placeholder="defaults to the email address"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
              </form.Field>
              {configFields
                .filter((f) => !f.capability || caps.includes(f.capability))
                .map((f) => (
                  <form.Field key={f.key} name={`config.${f.key}`}>
                    {(field) =>
                      f.type === "boolean" ? (
                        <label className="flex items-center justify-between gap-2 text-sm">
                          {f.label}
                          <Switch checked={!!field.state.value} onCheckedChange={(v) => field.handleChange(v)} />
                        </label>
                      ) : (
                        <div className={cn("flex flex-col gap-2", f.key === "caldavUrl" && "col-span-2")}>
                          <Label htmlFor={`acc-${f.key}`}>{f.label}</Label>
                          <Input
                            id={`acc-${f.key}`}
                            type={f.type === "number" ? "number" : "text"}
                            placeholder={f.placeholder}
                            value={String(field.state.value ?? "")}
                            onChange={(e) => field.handleChange(f.type === "number" ? Number(e.target.value) : e.target.value)}
                          />
                        </div>
                      )
                    }
                  </form.Field>
                ))}
            </div>
          )}
        </form.Subscribe>
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

function OAuthStart({ preset, onStart, pending }: { preset: ConnectorPreset; onStart: (capabilities: AccountCapability[]) => void; pending: boolean }) {
  const [caps, setCaps] = useState<AccountCapability[]>(preset.capabilities);
  return (
    <div className="flex flex-col gap-4">
      <CapabilityPicker available={preset.capabilities} value={caps} onChange={setCaps} />
      <p className="text-muted-foreground text-sm">
        You'll be sent to {preset.label} to grant access
        {caps.length === 2 ? " to mail and calendar" : caps[0] === "calendar" ? " to your calendar" : " to your mailbox"}. Mail and events are copied into
        twodb; changes you make to provider calendars wait in <strong>Pending push</strong> until you approve them.
      </p>
      <Button disabled={pending || !caps.length} onClick={() => onStart(caps)}>
        {pending ? <Loader2 className="animate-spin" /> : null} Continue with {preset.label}
      </Button>
    </div>
  );
}

export function AddAccountDialog({
  open,
  onOpenChange,
  meta,
  onOAuth,
  oauthPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meta: EmailMeta;
  onOAuth: (provider: OAuthProvider, capabilities: AccountCapability[]) => void;
  oauthPending: boolean;
}) {
  const [presetId, setPresetId] = useState<string | null>(null);
  const preset = meta.presets.find((p) => p.id === presetId) ?? null;
  const close = (v: boolean) => {
    if (!v) setPresetId(null);
    onOpenChange(v);
  };
  const oauthReady = (p: ConnectorPreset) => (p.kind === "google" ? meta.gmail.configured : p.kind === "microsoft" ? meta.microsoft.configured : true);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{preset ? `Connect ${preset.label}` : "Add account"}</DialogTitle>
          <DialogDescription>One login can power both mail and calendar. Everything is copied into twodb and stored locally.</DialogDescription>
        </DialogHeader>
        {!preset ? (
          <div className="grid grid-cols-2 gap-2">
            {meta.presets.map((p) => {
              const Icon = PRESET_ICON[p.id] ?? Mail;
              const ready = oauthReady(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!ready}
                  onClick={() => setPresetId(p.id)}
                  className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="bg-muted grid size-9 shrink-0 place-items-center rounded-md">
                    <Icon size={16} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <strong className="text-sm font-medium">{p.label}</strong>
                    <span className="text-muted-foreground text-xs">{ready ? p.description : "Admin must configure the OAuth client first"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : preset.auth === "oauth" ? (
          <OAuthStart preset={preset} pending={oauthPending} onStart={(caps) => onOAuth(preset.kind as OAuthProvider, caps)} />
        ) : (
          <PasswordForm preset={preset} fields={meta.imapFields} onDone={() => close(false)} />
        )}
        {preset ? (
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setPresetId(null)}>
            ← All providers
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
