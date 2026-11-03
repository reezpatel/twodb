import type { ComponentProps } from "react";
import { Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsCard, SettingsCardHeader, SettingsCardRow, SettingsRowText } from "../settings-card";
import type { SharedDatabase } from "./settings-shared-databases";

export interface ShareTargets {
  default: string | null;
  instagram: string | null;
}

export interface SettingsShareTargetsProps extends Omit<ComponentProps<typeof SettingsCard>, "onChange"> {
  databases: SharedDatabase[];
  /** The draft (unsaved) selection. */
  targets: ShareTargets;
  onTargetsChange: (targets: ShareTargets) => void;
  /** True when the draft differs from what's saved — enables the Save button. */
  dirty?: boolean;
  onSave?: () => void;
  saving?: boolean;
  error?: string | null;
}

/** Radix Select can't hold an empty value, so "not set" travels as this sentinel. */
const NONE = "__none__";

/** Which database shared links land in: a default and an optional Instagram one. Controlled. */
export function SettingsShareTargets({ databases, targets, onTargetsChange, dirty, onSave, saving, error, ...props }: SettingsShareTargetsProps) {
  const options = databases.map((database) => (
    <SelectItem key={database.id} value={database.id}>
      {database.title || "Untitled database"}
    </SelectItem>
  ));

  return (
    <SettingsCard data-slot="settings-share-targets" {...props}>
      <SettingsCardHeader icon={Share2} title="Share targets">
        <Button type="button" size="sm" variant="secondary" disabled={!dirty || saving} onClick={onSave}>
          {saving ? <Loader2 className="animate-spin" /> : null} Save
        </Button>
      </SettingsCardHeader>

      <SettingsCardRow divider className="flex items-center justify-between gap-4">
        <SettingsRowText title="Default database" description="Where shared links go." htmlFor="share-target-default" />
        <Select value={targets.default ?? NONE} onValueChange={(value) => onTargetsChange({ ...targets, default: value === NONE ? null : value })}>
          <SelectTrigger id="share-target-default" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— not set —</SelectItem>
            {options}
          </SelectContent>
        </Select>
      </SettingsCardRow>

      <SettingsCardRow className="flex items-center justify-between gap-4">
        <SettingsRowText title="Instagram database" description="Instagram links can go to their own database." htmlFor="share-target-instagram" />
        <Select value={targets.instagram ?? NONE} onValueChange={(value) => onTargetsChange({ ...targets, instagram: value === NONE ? null : value })}>
          <SelectTrigger id="share-target-instagram" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— same as default —</SelectItem>
            {options}
          </SelectContent>
        </Select>
      </SettingsCardRow>

      {error ? <p className="text-destructive px-5 pb-4 text-xs">{error}</p> : null}
    </SettingsCard>
  );
}
