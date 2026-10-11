import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { AlertTriangle, CheckCircle2, Copy, KeyRound, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmailMeta } from "../../email/email-api";
import { useOAuthClientForm, type OAuthProvider } from "./use-accounts-settings";

const COPY: Record<OAuthProvider, { title: string; description: string; steps: React.ReactNode[] }> = {
  google: {
    title: "Google OAuth client",
    description: "Each twodb deployment uses its own Google Cloud OAuth client to connect Gmail and Google Calendar.",
    steps: [
      <>
        In Google Cloud Console create a project and enable the <strong className="text-foreground">Gmail API</strong> and the{" "}
        <strong className="text-foreground">Google Calendar API</strong>.
      </>,
      <>
        Configure the OAuth consent screen (External) with the scopes <code>gmail.readonly</code>, <code>gmail.send</code> and <code>calendar</code>.
      </>,
      <>
        Create an OAuth client of type <strong className="text-foreground">Web application</strong> with the redirect URI below.
      </>,
      <>Paste the client ID and secret here. Existing Gmail accounts can turn on Calendar from their account row (Google asks for the extra permission).</>,
    ],
  },
  microsoft: {
    title: "Microsoft (Entra) app",
    description: "Connect Outlook.com and Microsoft 365 mail + calendar through Microsoft Graph with your own app registration.",
    steps: [
      <>
        In the Azure portal open <strong className="text-foreground">Microsoft Entra ID → App registrations → New registration</strong>. Supported account
        types: any organizational directory <em>and</em> personal Microsoft accounts.
      </>,
      <>Add a Web redirect URI (below), then create a client secret under Certificates &amp; secrets.</>,
      <>
        Under API permissions add delegated Microsoft Graph permissions <code>Mail.ReadWrite</code>, <code>Mail.Send</code>, <code>Calendars.ReadWrite</code>,{" "}
        <code>User.Read</code> and <code>offline_access</code>.
      </>,
      <>Paste the application (client) ID and secret here. Leave the tenant as "common" unless you only want one organization.</>,
    ],
  },
};

export function OAuthClientCard({ provider, meta }: { provider: OAuthProvider; meta: EmailMeta }) {
  const info = provider === "google" ? meta.gmail : meta.microsoft;
  const copy = COPY[provider];
  const { save, clear } = useOAuthClientForm(provider);
  const [copied, setCopied] = useState(false);
  const form = useForm({
    defaultValues: { clientId: info.clientId, clientSecret: "", tenant: provider === "microsoft" ? meta.microsoft.tenant : "" },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(provider === "microsoft" ? value : { clientId: value.clientId, clientSecret: value.clientSecret });
      form.setFieldValue("clientSecret", "");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound size={16} /> {copy.title}
          {info.configured ? <Badge variant="success">configured</Badge> : <Badge variant="secondary">not configured</Badge>}
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-xs leading-relaxed">
          {copy.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        {provider === "google" ? (
          <Alert>
            <AlertTriangle />
            <AlertTitle>Publish the app to "In production"</AlertTitle>
            <AlertDescription className="text-xs">
              While the consent screen is in <em>Testing</em>, Google expires refresh tokens after 7 days and accounts need reconnecting. An unverified
              production app shows a warning screen and is limited to 100 users — fine for self-hosting.
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label>Redirect URI</Label>
          <div className="flex gap-2">
            <Input readOnly value={info.redirectUri} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy redirect URI"
              onClick={() => {
                void navigator.clipboard.writeText(info.redirectUri);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <CheckCircle2 /> : <Copy />}
            </Button>
          </div>
        </div>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="clientId">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${provider}-client-id`}>Client ID</Label>
                <Input id={`${provider}-client-id`} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
              </div>
            )}
          </form.Field>
          <form.Field name="clientSecret">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${provider}-client-secret`}>Client secret</Label>
                <Input
                  id={`${provider}-client-secret`}
                  type="password"
                  placeholder={info.configured ? "•••••••• (unchanged)" : ""}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
          {provider === "microsoft" ? (
            <form.Field name="tenant">
              {(field) => (
                <div className="col-span-2 flex flex-col gap-2">
                  <Label htmlFor="microsoft-tenant">Tenant</Label>
                  <Input id="microsoft-tenant" placeholder="common" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
                </div>
              )}
            </form.Field>
          ) : null}
          <div className="col-span-2 flex items-center gap-2">
            {save.error ? <span className="text-destructive text-xs">{save.error.message}</span> : null}
            {info.configured ? (
              <Button type="button" variant="ghost" className="ml-auto" disabled={clear.isPending} onClick={() => clear.mutate()}>
                Remove
              </Button>
            ) : null}
            <Button type="submit" className={info.configured ? undefined : "ml-auto"} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : null} Save client
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
