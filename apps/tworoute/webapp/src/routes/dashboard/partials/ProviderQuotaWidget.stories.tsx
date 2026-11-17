import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConnectionsContext } from "../../../lib/connections-context.js";
import type { useConnections } from "../../connections/hooks/useConnections.js";
import type { QuotaSnapshot } from "../../../lib/tworoute-client.js";
import { ProviderQuotaWidget } from "./ProviderQuotaWidget.js";

/** Two providers: openai has two connections' windows rolled up (the worst
 * one — 92% — drives the badge), anthropic has a balanced window + a
 * text-only balance. */
const quotas: QuotaSnapshot[] = [
  { id: "q1", connectionId: "c1", quotaType: "Requests / 5h", quotaUsed: 460, quotaTotal: 500, groupName: "", capturedAt: "", unit: "requests", resetAt: new Date(Date.now() + 2 * 3_600_000).toISOString() },
  { id: "q2", connectionId: "c2", quotaType: "Tokens / week", quotaUsed: 1_800_000, quotaTotal: 5_000_000, groupName: "", capturedAt: "", unit: "tokens", resetAt: new Date(Date.now() + 4 * 86_400_000).toISOString() },
  { id: "q3", connectionId: "c3", quotaType: "Weekly usage", quotaUsed: 31, quotaTotal: 100, groupName: "", capturedAt: "", unit: "percent", resetAt: new Date(Date.now() + 30 * 3_600_000).toISOString() },
  { id: "q4", connectionId: "c3", quotaType: "Credit balance", quotaUsed: 42.15, quotaTotal: null, groupName: "", capturedAt: "", unit: "usd", resetAt: null },
];

const fixture = {
  connections: [
    { id: "c1", spaceId: "s1", spaceIds: ["s1"], name: "openai-prod", provider: "openai", baseUrl: "", defaultModel: null, createdAt: "" },
    { id: "c2", spaceId: "s1", spaceIds: ["s1"], name: "openai-eu", provider: "openai", baseUrl: "", defaultModel: null, createdAt: "" },
    { id: "c3", spaceId: "s1", spaceIds: ["s1"], name: "claude-main", provider: "anthropic", baseUrl: "", defaultModel: null, createdAt: "" },
  ],
  providers: [
    { id: "openai", label: "OpenAI", fields: [], api: "openai" as const },
    { id: "anthropic", label: "Anthropic", fields: [], api: "anthropic" as const },
  ],
  quotas,
};

function Harness({ empty = false, scope = null }: { empty?: boolean; scope?: string | null }) {
  const ctx = React.useMemo(
    () =>
      ({
        connections: fixture.connections,
        providers: fixture.providers,
        quotas: empty ? [] : fixture.quotas,
        busy: false,
        refreshAllQuotas: async () => null,
      }) as unknown as ReturnType<typeof useConnections>,
    [empty],
  );
  return (
    <ConnectionsContext.Provider value={ctx}>
      <div style={{ width: "min(480px, calc(100vw - 32px))", height: 380 }} className="border border-outline bg-paper">
        <ProviderQuotaWidget scope={scope} />
      </div>
    </ConnectionsContext.Provider>
  );
}

const meta = {
  title: "TwoRoute/Dashboard/ProviderQuotaWidget",
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Aggregate board: every connection, grouped by provider. */
export const WithData: Story = { render: () => <Harness /> };

/** Connection board: only that connection's own windows, no provider groups. */
export const Scoped: Story = { render: () => <Harness scope="claude-main" /> };

export const Empty: Story = { render: () => <Harness empty /> };
