import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { EmailAccount } from "../../email/email-api";

export function EditAccountDialog({
  account,
  onOpenChange,
  onSave,
}: {
  account: EmailAccount | null;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: Record<string, unknown>) => Promise<unknown>;
}) {
  return (
    <Dialog open={!!account} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {account?.address}</DialogTitle>
          <DialogDescription>Identity, signature, sync and contact settings for this account.</DialogDescription>
        </DialogHeader>
        {account ? <EditAccountForm key={account.id} account={account} onSave={onSave} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EditAccountForm({
  account,
  onSave,
  onDone,
}: {
  account: EmailAccount;
  onSave: (patch: Record<string, unknown>) => Promise<unknown>;
  onDone: () => void;
}) {
  const isImap = account.kind === "imap";
  const hasMail = account.capabilities.includes("mail");
  const hasCalendar = account.capabilities.includes("calendar");
  const form = useForm({
    defaultValues: {
      displayName: account.displayName ?? "",
      aliases: account.aliases.join(", "),
      signatureHtml: account.signatureHtml ?? "",
      syncIntervalSec: account.syncIntervalSec,
      paused: account.status === "paused",
      password: "",
      imapHost: String(account.config.imapHost ?? ""),
      imapPort: Number(account.config.imapPort ?? 993),
      smtpHost: String(account.config.smtpHost ?? ""),
      smtpPort: Number(account.config.smtpPort ?? 465),
      appendToSent: !!account.config.appendToSent,
      caldavUrl: String(account.config.caldavUrl ?? ""),
      syncMode: account.syncMode,
      suggestOrgMembers: account.suggestOrgMembers,
      calendarPaused: account.calendarState === "paused",
    },
    onSubmit: async ({ value }) => {
      const patch: Record<string, unknown> = {
        displayName: value.displayName,
        aliases: value.aliases.split(/[,\s]+/).filter(Boolean),
        signatureHtml: value.signatureHtml,
        syncIntervalSec: Number(value.syncIntervalSec),
        paused: value.paused,
        syncMode: value.syncMode,
        suggestOrgMembers: value.suggestOrgMembers,
        ...(hasCalendar ? { calendarPaused: value.calendarPaused } : {}),
      };
      if (isImap) {
        const config: Record<string, unknown> = {
          ...(hasMail
            ? { imapHost: value.imapHost, imapPort: value.imapPort, smtpHost: value.smtpHost, smtpPort: value.smtpPort, appendToSent: value.appendToSent }
            : {}),
          ...(hasCalendar ? { caldavUrl: value.caldavUrl } : {}),
        };
        const changed = Object.entries(config).some(([k, v]) => account.config[k] !== v);
        if (changed) patch.config = config;
        if (value.password) patch.password = value.password;
      }
      await onSave(patch);
      onDone();
    },
  });

  const text = (name: "displayName" | "aliases" | "imapHost" | "smtpHost" | "password" | "caldavUrl", label: string, props: Record<string, unknown> = {}) => (
    <form.Field name={name}>
      {(field) => (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`edit-${name}`}>{label}</Label>
          <Input id={`edit-${name}`} value={String(field.state.value)} onChange={(e) => field.handleChange(e.target.value)} {...props} />
        </div>
      )}
    </form.Field>
  );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      {text("displayName", "Display name")}
      {hasMail ? text("aliases", "Send-as aliases (comma separated)", { placeholder: "alex@company.com" }) : null}
      {hasMail ? (
        <form.Field name="signatureHtml">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-signature">Signature (HTML)</Label>
              <Textarea id="edit-signature" rows={3} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
            </div>
          )}
        </form.Field>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <form.Field name="syncIntervalSec">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-interval">Check for new mail every (sec)</Label>
              <Input
                id="edit-interval"
                type="number"
                min={30}
                max={3600}
                value={field.state.value}
                onChange={(e) => field.handleChange(Number(e.target.value))}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="paused">
          {(field) => (
            <label className="flex items-end justify-between gap-2 pb-2 text-sm">
              Pause mail sync
              <Switch checked={field.state.value} onCheckedChange={(v) => field.handleChange(v)} />
            </label>
          )}
        </form.Field>
        {hasCalendar ? (
          <form.Field name="syncMode">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label>Calendar updates</Label>
                <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as "polling" | "webhooks")} disabled={isImap}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="polling">Polling (every minute)</SelectItem>
                    <SelectItem value="webhooks">Push notifications + polling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
        ) : null}
        {hasCalendar ? (
          <form.Field name="calendarPaused">
            {(field) => (
              <label className="flex items-end justify-between gap-2 pb-2 text-sm">
                Pause calendar sync
                <Switch checked={field.state.value} onCheckedChange={(v) => field.handleChange(v)} />
              </label>
            )}
          </form.Field>
        ) : null}
      </div>
      <form.Field name="suggestOrgMembers">
        {(field) => (
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <span className="flex flex-col">
              Suggest people from my organization
              <span className="text-muted-foreground text-xs">
                Adds twodb members to this account's To/Cc and guest suggestions. Off: only people you've emailed or met through this account.
              </span>
            </span>
            <Switch checked={field.state.value} onCheckedChange={(v) => field.handleChange(v)} />
          </label>
        )}
      </form.Field>
      {isImap ? (
        <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
          {hasCalendar ? <div className="col-span-2">{text("caldavUrl", "CalDAV URL")}</div> : null}
          {hasMail ? (
            <>
              {text("imapHost", "IMAP host")}
              <form.Field name="imapPort">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="edit-imapPort">IMAP port</Label>
                    <Input id="edit-imapPort" type="number" value={field.state.value} onChange={(e) => field.handleChange(Number(e.target.value))} />
                  </div>
                )}
              </form.Field>
              {text("smtpHost", "SMTP host")}
              <form.Field name="smtpPort">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="edit-smtpPort">SMTP port</Label>
                    <Input id="edit-smtpPort" type="number" value={field.state.value} onChange={(e) => field.handleChange(Number(e.target.value))} />
                  </div>
                )}
              </form.Field>
              <form.Field name="appendToSent">
                {(field) => (
                  <label className="col-span-2 flex items-center justify-between gap-2 text-sm">
                    Save a copy to the server's Sent folder
                    <Switch checked={field.state.value} onCheckedChange={(v) => field.handleChange(v)} />
                  </label>
                )}
              </form.Field>
            </>
          ) : null}
          <div className="col-span-2">{text("password", "New password (leave empty to keep)", { type: "password", autoComplete: "new-password" })}</div>
        </div>
      ) : null}
      <form.Subscribe selector={(s) => [s.isSubmitting, s.errorMap.onSubmit] as const}>
        {([submitting, error]) => (
          <DialogFooter>
            {error ? <span className="text-destructive mr-auto text-xs">{String(error)}</span> : null}
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        )}
      </form.Subscribe>
    </form>
  );
}
