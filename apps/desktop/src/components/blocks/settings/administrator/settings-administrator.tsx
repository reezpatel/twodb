import type { ComponentProps } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

const DIVIDER = "after:border-foreground/[0.09] after:absolute after:right-5 after:bottom-0 after:left-5 after:border-b-[0.5px] after:content-['']";

export interface SettingsAdministratorProps extends Omit<ComponentProps<"section">, "onChange"> {
  /** Whether the register page is open to new accounts. */
  signUpEnabled: boolean;
  onSignUpEnabledChange: (enabled: boolean) => void;
  /** First load in flight. */
  loading?: boolean;
  /** Saving a change — the switch is disabled meanwhile. */
  saving?: boolean;
  /** Set when the settings can't be read (e.g. the user isn't an admin). Replaces the rows. */
  error?: string | null;
}

/** Instance-wide admin settings, in the same card style as the General page. Controlled. */
export function SettingsAdministrator({ signUpEnabled, onSignUpEnabledChange, loading, saving, error, className, ...props }: SettingsAdministratorProps) {
  return (
    <section
      data-slot="settings-administrator"
      className={cn("bg-card text-muted-foreground overflow-hidden rounded-sm font-sans text-sm font-[450] tracking-[-0.05px]", className)}
      {...props}
    >
      <header className={cn("relative flex min-h-14 items-center gap-2 px-5 py-3", DIVIDER)}>
        <ShieldCheck className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-muted-foreground text-sm leading-5 font-medium">Administrator</h3>
        </div>
        <span className="text-muted-foreground/70 ml-auto shrink-0 text-xs">Applies to every organization</span>
      </header>

      {error ? (
        <p className="text-muted-foreground px-5 py-4 text-sm">{error}</p>
      ) : loading ? (
        <p className="text-muted-foreground flex items-center gap-2 px-5 py-4 text-sm">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Loading…
        </p>
      ) : (
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <label htmlFor="sign-up-toggle" className="text-foreground text-sm font-medium">
              Allow new sign-ups
            </label>
            <p className="text-muted-foreground/70 text-xs">When off, the register page is closed and /sign-up/email returns 403.</p>
          </div>
          <Switch id="sign-up-toggle" checked={signUpEnabled} disabled={saving} onCheckedChange={onSignUpEnabledChange} />
        </div>
      )}
    </section>
  );
}
