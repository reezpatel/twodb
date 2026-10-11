import { useRef, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CheckCircle2, Download, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EmailAccount } from "../../email/email-api";
import { AccountRow } from "./account-row";
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Accounts</h1>
        <p className="text-muted-foreground text-sm">
          Connected logins for mail and calendar. Everything is copied into twodb; each account keeps its own contacts.
        </p>
      </div>

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

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Connected accounts</CardTitle>
            <CardDescription>
              Google, Microsoft, iCloud, Fastmail, Yahoo, Nextcloud or any IMAP/CalDAV server. Private by default; sharing an account shares its mail, calendars
              and contacts.
            </CardDescription>
          </div>
          <Button onClick={() => setAdding(true)} disabled={!meta}>
            <Plus /> Add account
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {s.accounts.isLoading ? <Loader2 className="text-muted-foreground animate-spin" /> : null}
          {!s.accounts.isLoading && !accounts.length ? <p className="text-muted-foreground py-6 text-center text-sm">No accounts connected yet.</p> : null}
          {accounts.map((a) => (
            <AccountRow
              key={a.id}
              account={a}
              testResult={testResult[a.id]}
              onToggleCapability={(capability, on) =>
                s.setCapabilities.mutate({
                  account: a,
                  capabilities: on ? [...new Set([...a.capabilities, capability])] : a.capabilities.filter((c) => c !== capability),
                })
              }
              onSync={() => s.syncNow.mutate(a)}
              onTest={() => void runTest(a)}
              onEdit={() => setEditing(a)}
              onShare={() => setSharing(a)}
              onReconnect={() => a.kind !== "imap" && s.oauth.mutate({ provider: a.kind, capabilities: a.capabilities, accountId: a.id })}
              onImport={() => {
                setImportFor(a.id);
                importRef.current?.click();
              }}
              onRemove={() => setDeleting(a)}
              onBackfill={(op) => s.backfill.mutate({ id: a.id, op })}
            />
          ))}
          {s.setCapabilities.error ? <p className="text-destructive text-xs">{s.setCapabilities.error.message}</p> : null}
          {s.importEml.data ? (
            <p className="text-muted-foreground text-xs">
              <Download size={12} className="mr-1 inline" />
              Imported {s.importEml.data.inserted} message(s).
            </p>
          ) : null}
          {s.importEml.error ? <p className="text-destructive text-xs">{s.importEml.error.message}</p> : null}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spam rules</CardTitle>
          <CardDescription>Senders and domains you chose to always route to Spam. Applied locally to newly synced mail.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {!(s.senderRules.data ?? []).length ? (
            <p className="text-muted-foreground text-sm">No rules yet — use "Always send to Spam" when marking mail as spam.</p>
          ) : null}
          {(s.senderRules.data ?? []).map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
              <Badge variant="outline">{r.matchType}</Badge>
              <span className="flex-1 truncate font-mono text-xs">{r.matchType === "domain" ? `@${r.value}` : r.value}</span>
              <Button variant="ghost" size="icon-xs" aria-label="Delete rule" onClick={() => s.removeRule.mutate(r.id)}>
                <Trash2 />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

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
