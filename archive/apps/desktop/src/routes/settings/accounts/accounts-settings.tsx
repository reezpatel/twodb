import { useRef, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CheckCircle2, Download, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EmailAccount } from "../../email/email-api";
import { SettingsAccounts } from "@/components/blocks/settings/accounts/settings-accounts";
import { SettingsSpamRules } from "@/components/blocks/settings/accounts/settings-spam-rules";
import { toSettingsAccount } from "./to-settings-account";
import { AddAccountDialog } from "./add-account-dialog";
import { EditAccountDialog } from "./edit-account-dialog";
import { OAuthClientCard } from "./oauth-client-card";
import { SharingDialog } from "./sharing-dialog";
import { useAccountsSettings } from "./use-accounts-settings";

export function AccountsSection() {
  const s = useAccountsSettings();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EmailAccount | null>(null);
  const [sharing, setSharing] = useState<EmailAccount | null>(null);
  const [deleting, setDeleting] = useState<EmailAccount | null>(null);
  const [purgeMail, setPurgeMail] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const importRef = useRef<HTMLInputElement>(null);
  const [importFor, setImportFor] = useState<string | null>(null);
  const meta = s.meta.data;
  const accounts = s.accounts.data ?? [];

  const runTest = async (a: EmailAccount) => {
    setTestResult((r) => ({ ...r, [a.id]: "Testing…" }));
    const res = await s.test.mutateAsync(a.id).catch((e: Error) => ({ ok: false, error: e.message }));
    setTestResult((r) => ({ ...r, [a.id]: res.ok ? "Connection OK" : `Failed: ${res.error}` }));
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {s.oauthNotice ? (
        <Alert variant={s.oauthNotice.ok ? "default" : "destructive"}>
          {s.oauthNotice.ok ? <CheckCircle2 /> : <AlertTriangle />}
          <AlertTitle>{s.oauthNotice.ok ? `${s.oauthNotice.provider} connected` : `${s.oauthNotice.provider} connection failed`}</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2 text-xs">
            {s.oauthNotice.ok ? "Syncing now — history imports in the background." : s.oauthNotice.reason}
            <Button variant="ghost" size="xs" onClick={s.dismissNotice}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {meta && !meta.storageReady ? (
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>Email attachments storage is not configured</AlertTitle>
          <AlertDescription className="text-xs">
            Synced messages, raw .eml files and attachments are stored in the <strong>Email Attachments</strong> destination. Mail sync is blocked until it is
            set in{" "}
            <Link to="/apps/settings/storage" className="underline">
              Storage settings
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <SettingsAccounts
        accounts={accounts.map((a) => toSettingsAccount(a, testResult[a.id]))}
        loading={s.accounts.isLoading}
        note="Google, Microsoft, iCloud, Fastmail, Yahoo, Nextcloud or any IMAP/CalDAV server. Private by default; sharing an account shares its mail, calendars and contacts."
        onAdd={meta ? () => setAdding(true) : undefined}
        onToggleCapability={(id, capability, on) => {
          const a = accounts.find((x) => x.id === id);
          if (a)
            s.setCapabilities.mutate({
              account: a,
              capabilities: on ? [...new Set([...a.capabilities, capability])] : a.capabilities.filter((c) => c !== capability),
            });
        }}
        onSync={(id) => {
          const a = accounts.find((x) => x.id === id);
          if (a) s.syncNow.mutate(a);
        }}
        onTest={(id) => {
          const a = accounts.find((x) => x.id === id);
          if (a) void runTest(a);
        }}
        onEdit={(id) => setEditing(accounts.find((x) => x.id === id) ?? null)}
        onShare={(id) => setSharing(accounts.find((x) => x.id === id) ?? null)}
        onReconnect={(id) => {
          const a = accounts.find((x) => x.id === id);
          if (!a) return;
          // Password (IMAP) accounts re-enter credentials in the edit dialog; OAuth ones go back through the provider.
          if (a.kind === "imap") setEditing(a);
          else s.oauth.mutate({ provider: a.kind, capabilities: a.capabilities, accountId: a.id });
        }}
        onImport={(id) => {
          setImportFor(id);
          importRef.current?.click();
        }}
        onRemove={(id) => setDeleting(accounts.find((x) => x.id === id) ?? null)}
        onTogglePause={(id, paused) => s.backfill.mutate({ id, op: paused ? "pause" : "resume" })}
        footer={
          <>
            {s.setCapabilities.error ? <p className="text-destructive text-xs">{s.setCapabilities.error.message}</p> : null}
            {s.importEml.data ? (
              <p className="text-muted-foreground text-xs">
                <Download size={12} className="mr-1 inline" />
                Imported {s.importEml.data.inserted} message(s).
              </p>
            ) : null}
            {s.importEml.error ? <p className="text-destructive text-xs">{s.importEml.error.message}</p> : null}
          </>
        }
      />
      <input
        ref={importRef}
        type="file"
        accept=".eml,message/rfc822"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (importFor && files.length) s.importEml.mutate({ id: importFor, files });
          e.target.value = "";
        }}
      />

      <SettingsSpamRules rules={s.senderRules.data ?? []} onDelete={(id) => s.removeRule.mutate(id)} />

      {meta?.isAdmin ? (
        <>
          <OAuthClientCard key={`g-${meta.gmail.clientId}`} provider="google" meta={meta} />
          <OAuthClientCard key={`m-${meta.microsoft.clientId}`} provider="microsoft" meta={meta} />
        </>
      ) : null}

      {meta ? (
        <AddAccountDialog
          open={adding}
          onOpenChange={setAdding}
          meta={meta}
          onOAuth={(provider, capabilities) => s.oauth.mutate({ provider, capabilities })}
          oauthPending={s.oauth.isPending}
        />
      ) : null}
      <EditAccountDialog account={editing} onOpenChange={(o) => !o && setEditing(null)} onSave={(patch) => s.update.mutateAsync({ id: editing!.id, patch })} />
      <SharingDialog account={sharing ? (accounts.find((a) => a.id === sharing.id) ?? sharing) : null} onOpenChange={(o) => !o && setSharing(null)} />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {deleting?.address}?</DialogTitle>
            <DialogDescription>
              Sync stops and the stored credentials are deleted. Nothing is deleted at the provider. Reconnecting the same login later brings its contacts back.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={purgeMail} onCheckedChange={(v) => setPurgeMail(v === true)} />
            <span>
              Also delete all locally stored mail, calendars and attachments for this account
              <span className="text-muted-foreground block text-xs">Otherwise the data stays stored but is no longer shown.</span>
            </span>
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={s.remove.isPending}
              onClick={() =>
                deleting &&
                s.remove.mutate(
                  { id: deleting.id, purgeMail },
                  {
                    onSuccess: () => {
                      setDeleting(null);
                      setPurgeMail(false);
                    },
                  },
                )
              }
            >
              {s.remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
