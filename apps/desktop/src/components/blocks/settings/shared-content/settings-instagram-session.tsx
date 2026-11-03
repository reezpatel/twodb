import { useState, type ComponentProps } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsCard, SettingsCardHeader, SettingsCardRow } from "../settings-card";

export interface SettingsInstagramSessionProps extends Omit<ComponentProps<typeof SettingsCard>, "onSubmit"> {
  configured: boolean;
  /** Masked cookie value shown next to the "configured" status. */
  masked?: string | null;
  /** Saves a pasted sessionid; an empty string clears it. */
  onSave: (sessionId: string) => void;
  saving?: boolean;
  error?: string | null;
}

/** Optional Instagram `sessionid` cookie so the processor can fetch posts behind login gates. Controlled; the secret is never shown back in full. */
export function SettingsInstagramSession({ configured, masked, onSave, saving, error, ...props }: SettingsInstagramSessionProps) {
  const [value, setValue] = useState("");

  return (
    <SettingsCard data-slot="settings-instagram-session" {...props}>
      <SettingsCardHeader icon={Camera} title="Instagram session">
        {configured ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-500">
            Configured{masked ? <span className="text-muted-foreground/70 font-mono"> ({masked})</span> : null}
          </span>
        ) : (
          <span className="text-muted-foreground/70 text-xs">Not configured</span>
        )}
      </SettingsCardHeader>

      <SettingsCardRow className="flex flex-col gap-3">
        <p className="text-muted-foreground/70 text-xs">
          Optional <code className="text-foreground font-mono">sessionid</code> cookie from a logged-in instagram.com browser session. It lets the processor
          fetch posts behind login and age gates. Instagram expires these — paste a fresh one when processing starts failing. Paste it exactly as shown in
          DevTools (URL-encoded is fine). Stored on the server, never shown back in full.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim() && !saving) {
              onSave(value.trim());
              setValue("");
            }
          }}
        >
          <Input
            className="h-8 flex-1 font-mono text-xs"
            type="password"
            autoComplete="off"
            placeholder={configured ? "Paste new sessionid to replace" : "Paste sessionid cookie value"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Instagram sessionid"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={!value.trim() || saving}>
            {saving ? <Loader2 className="animate-spin" /> : null} Save
          </Button>
          {configured ? (
            <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => onSave("")}>
              Clear
            </Button>
          ) : null}
        </form>
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </SettingsCardRow>
    </SettingsCard>
  );
}
