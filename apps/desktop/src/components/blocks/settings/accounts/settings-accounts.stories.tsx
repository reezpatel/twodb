import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SettingsAccounts, type SettingsAccount } from "./settings-accounts";
import { SettingsOAuthClient } from "./settings-oauth-client";
import { SettingsSpamRules, type SpamRule } from "./settings-spam-rules";

const ACCOUNTS: SettingsAccount[] = [
  {
    id: "a1",
    name: "Ava Elizabeth · ava@example.com",
    initials: "AE",
    provider: "Google",
    owner: true,
    mail: true,
    calendar: true,
    reconnectLabel: "Google",
    lines: [
      { kind: "mail", state: "active", summary: "last checked 2m ago · history imported (12,408 messages)" },
      { kind: "calendar", state: "active", summary: "last checked 2m ago · push" },
    ],
  },
  {
    id: "a2",
    name: "ava@work.dev",
    initials: "AW",
    provider: "Microsoft",
    owner: true,
    mail: true,
    calendar: false,
    shared: true,
    reconnectLabel: "Microsoft",
    lines: [
      {
        kind: "mail",
        state: "active",
        summary: "last checked just now",
        progress: { value: 42, label: "5,210 / 12,400 importing history" },
        canTogglePause: true,
      },
    ],
  },
  {
    id: "a3",
    name: "billing@studio.io",
    initials: "BS",
    provider: "IMAP / CalDAV",
    owner: true,
    mail: true,
    calendar: true,
    needsReconnect: true,
    reconnectLabel: null,
    testResult: "Failed: authentication rejected",
    lines: [
      { kind: "mail", state: "reauth_required", summary: "last checked 3d ago", error: "AUTHENTICATIONFAILED Invalid credentials" },
      { kind: "calendar", state: "paused", summary: "last checked 3d ago" },
    ],
  },
  {
    id: "a4",
    name: "team@shared.org",
    initials: "TS",
    provider: "Fastmail",
    owner: false,
    role: "editor",
    shared: true,
    mail: true,
    calendar: false,
    lines: [{ kind: "mail", state: "active", summary: "last checked 8m ago" }],
  },
];

const handlers = {
  onToggleCapability: () => {},
  onSync: () => {},
  onTest: () => {},
  onEdit: () => {},
  onShare: () => {},
  onReconnect: () => {},
  onImport: () => {},
  onRemove: () => {},
  onTogglePause: () => {},
};

const NOTE =
  "Google, Microsoft, iCloud, Fastmail, Yahoo, Nextcloud or any IMAP/CalDAV server. Private by default; sharing an account shares its mail, calendars and contacts.";

const meta = {
  title: "Blocks/Settings/Accounts/ConnectedAccounts",
  component: SettingsAccounts,
  parameters: { layout: "padded" },
  args: { accounts: ACCOUNTS, note: NOTE, onAdd: () => {}, ...handlers },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsAccounts>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Toggle Mail / Calendar; at least one stays on. */
export const Interactive: Story = {
  render: (args) => {
    const [accounts, setAccounts] = useState(args.accounts);
    return (
      <SettingsAccounts
        {...args}
        accounts={accounts}
        onToggleCapability={(id, capability, on) => setAccounts((cur) => cur.map((a) => (a.id === id ? { ...a, [capability]: on } : a)))}
        onRemove={(id) => setAccounts((cur) => cur.filter((a) => a.id !== id))}
      />
    );
  },
};

export const Empty: Story = { args: { accounts: [] } };

export const Loading: Story = { args: { accounts: [], loading: true } };

export const WithFooter: Story = { args: { footer: <p className="text-muted-foreground text-xs">Imported 14 message(s).</p> } };

const RULES: SpamRule[] = [
  { id: "r1", matchType: "domain", value: "promo-deals.example" },
  { id: "r2", matchType: "sender", value: "noreply@newsletter.example" },
  { id: "r3", matchType: "sender", value: "winner@prizes.example" },
];

export const SpamRules: StoryObj<typeof SettingsSpamRules> = {
  render: () => {
    const [rules, setRules] = useState(RULES);
    return (
      <div className="mx-auto max-w-3xl">
        <SettingsSpamRules rules={rules} onDelete={(id) => setRules((cur) => cur.filter((r) => r.id !== id))} />
      </div>
    );
  },
};

export const SpamRulesEmpty: StoryObj<typeof SettingsSpamRules> = { render: () => <SettingsSpamRules rules={[]} className="mx-auto max-w-3xl" /> };

const OAUTH_STEPS = [
  <>
    In Google Cloud Console create a project and enable the <strong className="text-foreground">Gmail API</strong> and the{" "}
    <strong className="text-foreground">Google Calendar API</strong>.
  </>,
  <>
    Create an OAuth client of type <strong className="text-foreground">Web application</strong> with the redirect URI below.
  </>,
  <>Paste the client ID and secret here.</>,
];

export const OAuthClient: StoryObj<typeof SettingsOAuthClient> = {
  render: () => {
    const [configured, setConfigured] = useState(false);
    return (
      <div className="mx-auto max-w-3xl">
        <SettingsOAuthClient
          title="Google OAuth client"
          description="Each twodb deployment uses its own Google Cloud OAuth client to connect Gmail and Google Calendar."
          steps={OAUTH_STEPS}
          warning={{
            title: "Publish the app to “In production”",
            body: "While the consent screen is in Testing, Google expires refresh tokens after 7 days and accounts need reconnecting.",
          }}
          configured={configured}
          redirectUri="https://app.twodb.io/api/email/oauth/google/callback"
          clientId={configured ? "1234-abc.apps.googleusercontent.com" : ""}
          onSave={() => {
            setConfigured(true);
            return true;
          }}
          onRemove={() => setConfigured(false)}
        />
      </div>
    );
  },
};

export const OAuthClientMicrosoft: StoryObj<typeof SettingsOAuthClient> = {
  render: () => (
    <div className="mx-auto max-w-3xl">
      <SettingsOAuthClient
        title="Microsoft (Entra) app"
        description="Connect Outlook.com and Microsoft 365 mail + calendar through Microsoft Graph with your own app registration."
        steps={OAUTH_STEPS.slice(0, 2)}
        configured
        redirectUri="https://app.twodb.io/api/email/oauth/microsoft/callback"
        clientId="9f1c-0000-aaaa"
        tenant="common"
        showTenant
        onSave={() => true}
        onRemove={() => {}}
        error="Couldn't verify the secret."
      />
    </div>
  ),
};
