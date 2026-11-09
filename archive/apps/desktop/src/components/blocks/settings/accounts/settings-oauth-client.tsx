import { useState, type ComponentProps, type ReactNode } from "react";
import { AlertTriangle, Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsCard, SettingsCardHeader, SettingsCardRow } from "../settings-card";

export interface OAuthClientValues {
  clientId: string;
  clientSecret: string;
  tenant: string;
}

export interface SettingsOAuthClientProps extends Omit<ComponentProps<typeof SettingsCard>, "onSave" | "title"> {
  title: string;
  description: string;
  /** Numbered setup instructions. */
  steps: ReactNode[];
  /** Callout shown above the form, e.g. a publishing reminder. */
  warning?: { title: string; body: ReactNode };
  configured: boolean;
  redirectUri: string;
  /** Initial values; remount (key) to reset after the server changes them. */
  clientId: string;
  tenant?: string;
  /** Shows the Tenant field (Microsoft). */
  showTenant?: boolean;
  /** Resolves true when saved — the secret field is then cleared. */
  onSave: (values: OAuthClientValues) => Promise<boolean> | boolean;
  saving?: boolean;
  onRemove?: () => void;
  removing?: boolean;
  error?: string | null;
}

/** An OAuth app registration (client id / secret) for connecting a provider's mail and calendar. Holds its own field state. */
export function SettingsOAuthClient({
  title,
  description,
  steps,
  warning,
  configured,
  redirectUri,
  clientId: initialClientId,
  tenant: initialTenant = "",
  showTenant,
  onSave,
  saving,
  onRemove,
  removing,
  error,
  className,
  ...props
}: SettingsOAuthClientProps) {
  const [clientId, setClientId] = useState(initialClientId);
  const [clientSecret, setClientSecret] = useState("");
  const [tenant, setTenant] = useState(initialTenant);
  const [copied, setCopied] = useState(false);
  const idPrefix = title.toLowerCase().replace(/\W+/g, "-");

  return (
    <SettingsCard data-slot="settings-oauth-client" className={className} {...props}>
      <SettingsCardHeader icon={KeyRound} title={title}>
        {configured ? (
          <span className="rounded-md bg-emerald-500/10 px-1.5 py-px text-xs leading-5 text-emerald-600 dark:text-emerald-500">Configured</span>
        ) : (
          <span className="bg-foreground/6 text-muted-foreground rounded-md px-1.5 py-px text-xs leading-5">Not configured</span>
        )}
      </SettingsCardHeader>

      <SettingsCardRow divider className="flex flex-col gap-3 py-3">
        <p className="text-muted-foreground/70 text-xs">{description}</p>
        <ol className="text-muted-foreground/70 list-decimal space-y-1 pl-5 text-xs leading-relaxed">
          {steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
        {warning ? (
          <div className="flex gap-2 rounded-sm bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">{warning.title}</p>
              <p className="mt-0.5 opacity-90">{warning.body}</p>
            </div>
          </div>
        ) : null}
      </SettingsCardRow>

      <SettingsCardRow divider className="flex flex-col gap-2 py-3">
        <Label className="text-foreground text-sm font-medium">Redirect URI</Label>
        <div className="flex gap-2">
          <Input readOnly value={redirectUri} className="h-8 flex-1 font-mono text-xs" aria-label="Redirect URI" />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Copy redirect URI"
            onClick={() => {
              void navigator.clipboard?.writeText(redirectUri);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="text-emerald-600 dark:text-emerald-500" /> : <Copy />}
          </Button>
        </div>
      </SettingsCardRow>

      <SettingsCardRow>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await onSave({ clientId, clientSecret, tenant })) setClientSecret("");
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-client-id`} className="text-muted-foreground text-xs">
              Client ID
            </Label>
            <Input id={`${idPrefix}-client-id`} className="h-8 text-sm" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-client-secret`} className="text-muted-foreground text-xs">
              Client secret
            </Label>
            <Input
              id={`${idPrefix}-client-secret`}
              type="password"
              autoComplete="off"
              className="h-8 text-sm"
              placeholder={configured ? "•••••••• (unchanged)" : ""}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>
          {showTenant ? (
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor={`${idPrefix}-tenant`} className="text-muted-foreground text-xs">
                Tenant
              </Label>
              <Input id={`${idPrefix}-tenant`} className="h-8 text-sm" placeholder="common" value={tenant} onChange={(e) => setTenant(e.target.value)} />
            </div>
          ) : null}
          <div className="col-span-2 flex items-center gap-2">
            {error ? <span className="text-destructive text-xs">{error}</span> : null}
            {configured && onRemove ? (
              <Button type="button" variant="ghost" size="sm" className="ml-auto" disabled={removing} onClick={onRemove}>
                Remove
              </Button>
            ) : null}
            <Button type="submit" size="sm" variant="secondary" className={cn(!(configured && onRemove) && "ml-auto")} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null} Save client
            </Button>
          </div>
        </form>
      </SettingsCardRow>
    </SettingsCard>
  );
}
