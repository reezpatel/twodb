import type { ComponentProps } from "react";
import { Download, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DIVIDER = "after:border-foreground/[0.09] after:absolute after:right-5 after:bottom-0 after:left-5 after:border-b-[0.5px] after:content-['']";

export type SettingsTheme = "system" | "light" | "dark";

const THEME_OPTIONS: { value: SettingsTheme; label: string }[] = [
  { value: "system", label: "System (follow browser)" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** standalone = already running as the installed app; promptable = the browser offered install; unsupported = not (yet) installable. */
export type SettingsInstallState = "standalone" | "promptable" | "unsupported";

export interface SettingsAppearanceProps extends Omit<ComponentProps<"section">, "onChange"> {
  theme: SettingsTheme;
  onThemeChange: (theme: SettingsTheme) => void;
  /** Adds the "Install app" row. Omit to hide it (e.g. native builds). */
  installState?: SettingsInstallState;
  onInstall?: () => void;
}

/** Appearance preferences — currently the theme. Controlled. */
export function SettingsAppearance({ theme, onThemeChange, installState, onInstall, className, ...props }: SettingsAppearanceProps) {
  return (
    <section
      data-slot="settings-appearance"
      className={cn("bg-card text-muted-foreground overflow-hidden rounded-sm font-sans text-sm font-[450] tracking-[-0.05px]", className)}
      {...props}
    >
      <header
        className={cn(
          "relative flex min-h-14 items-center gap-2 px-5 py-3",
          "after:border-foreground/[0.09] after:absolute after:right-5 after:bottom-0 after:left-5 after:border-b-[0.5px] after:content-['']",
        )}
      >
        <SlidersHorizontal className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-muted-foreground text-sm leading-5 font-medium">General</h3>
        </div>
      </header>
      <div className={cn("relative flex items-center justify-between gap-4 px-5 py-4", installState && DIVIDER)}>
        <div>
          <p className="text-foreground text-sm font-medium">Theme</p>
          <p className="text-muted-foreground/70 text-xs">Light or dark. “System” follows your browser theme.</p>
        </div>
        <Select value={theme} onValueChange={(value) => onThemeChange(value as SettingsTheme)}>
          <SelectTrigger className="w-44" aria-label="Theme">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {THEME_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {installState ? (
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-foreground flex items-center gap-1.5 text-sm font-medium">
              <Download className="text-muted-foreground size-3.5" aria-hidden="true" /> Install app
            </p>
            <p className="text-muted-foreground/70 text-xs">
              {installState === "standalone"
                ? "Installed — you are running the app version."
                : installState === "promptable"
                  ? "Install twodb as a standalone desktop-style app."
                  : "Your browser hasn't offered installation yet — it needs HTTPS, a service worker and a moment of usage first. Chrome/Edge: ⋮ menu → Cast, save and share → Install page as app. Safari: Share → Add to Dock. Firefox: address-bar install icon."}
            </p>
          </div>
          {installState === "promptable" ? (
            <Button type="button" variant="secondary" size="sm" onClick={onInstall}>
              <Download data-icon="inline-start" /> Install
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
