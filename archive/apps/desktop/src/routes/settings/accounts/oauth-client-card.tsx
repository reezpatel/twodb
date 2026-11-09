import { SettingsOAuthClient } from "@/components/blocks/settings/accounts/settings-oauth-client";
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

  return (
    <SettingsOAuthClient
      title={copy.title}
      description={copy.description}
      steps={copy.steps}
      warning={
        provider === "google"
          ? {
              title: 'Publish the app to "In production"',
              body: "While the consent screen is in Testing, Google expires refresh tokens after 7 days and accounts need reconnecting. An unverified production app shows a warning screen and is limited to 100 users — fine for self-hosting.",
            }
          : undefined
      }
      configured={info.configured}
      redirectUri={info.redirectUri}
      clientId={info.clientId}
      tenant={provider === "microsoft" ? meta.microsoft.tenant : ""}
      showTenant={provider === "microsoft"}
      onSave={(v) =>
        save
          .mutateAsync(provider === "microsoft" ? v : { clientId: v.clientId, clientSecret: v.clientSecret })
          .then(() => true)
          .catch(() => false)
      }
      saving={save.isPending}
      onRemove={() => clear.mutate()}
      removing={clear.isPending}
      error={save.error?.message ?? null}
    />
  );
}
