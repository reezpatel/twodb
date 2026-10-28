import { useState } from "react";
import { Cpu, HardDrive, MemoryStick, MonitorCog } from "lucide-react";
import { ModelPickerPlayground } from "../../model-picker/model-picker.fixtures";
import {
  CodeChatResourceMetric,
  CodeChatResourceRunner,
  CodeChatResources,
  CodeChatResourcesEmpty,
  CodeChatResourcesSettings,
  CodeChatResourcesSettingsEmpty,
  CodeChatResourcesSettingsRunner,
  CodeChatResourcesSettingsToggle,
} from "./code-chat-resources";
import { CodeChatUsage, CodeChatUsageContext, CodeChatUsageSpacer, CodeChatUsageStat } from "./code-chat-usage";

export function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

type MockUsageProps = {
  input?: number;
  output?: number;
  cached?: number;
  context?: number;
  contextWindow?: number;
  tokensPerSecond?: number | null;
};

/** Story helper: the usage row as the real footer shows it, with the model picker on the right. */
export function MockUsage({ input = 12_400, output = 3_100, cached = 8_800, context = 15_500, contextWindow = 200_000, tokensPerSecond = 42 }: MockUsageProps) {
  const cachePercent = input > 0 ? Math.round((cached / input) * 100) : null;
  const contextPercent = Math.min(100, Math.round((context / contextWindow) * 100));

  return (
    <CodeChatUsage>
      <CodeChatUsageStat title="Input tokens (incl. cached)">↑ {formatTokens(input)}</CodeChatUsageStat>
      <CodeChatUsageStat title="Output tokens">↓ {formatTokens(output)}</CodeChatUsageStat>
      <CodeChatUsageStat title="Cache hit — cached input / total input">⚡ {cachePercent !== null ? `${cachePercent}%` : "—"}</CodeChatUsageStat>
      <CodeChatUsageStat title="Generation speed">{tokensPerSecond !== null ? `${tokensPerSecond} tok/s` : "—"}</CodeChatUsageStat>
      <CodeChatUsageContext
        percent={contextPercent}
        label={`${formatTokens(context)} / ${formatTokens(contextWindow)}`}
        title="Context consumed vs the model's context window"
      />
      <CodeChatUsageSpacer />
      <ModelPickerPlayground triggerClassName="min-h-6 rounded-lg px-1.5 py-0.5" />
    </CodeChatUsage>
  );
}

type MetricKind = "cpu" | "memory" | "gpu" | "disk";

type MockRunner = {
  id: string;
  name: string;
  cpu: number;
  memory: { used: number; total: number };
  gpus: { index: number; utilization: number; temperature: number }[];
  disks: { path: string; used: number; total: number }[];
};

const GB = 1e9;
const ALL_KINDS: MetricKind[] = ["cpu", "memory", "gpu", "disk"];

export const MOCK_RUNNERS: MockRunner[] = [
  {
    id: "r1",
    name: "workstation",
    cpu: 0.42,
    memory: { used: 21 * GB, total: 32 * GB },
    gpus: [{ index: 0, utilization: 88, temperature: 71 }],
    disks: [{ path: "/", used: 410 * GB, total: 500 * GB }],
  },
  {
    id: "r2",
    name: "build-box",
    cpu: 0.97,
    memory: { used: 15 * GB, total: 16 * GB },
    gpus: [],
    disks: [{ path: "/", used: 120 * GB, total: 250 * GB }],
  },
];

function formatBytes(value: number) {
  if (value >= 1e12) return `${(value / 1e12).toFixed(0)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(0)}G`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
  return `${Math.round(value / 1e3)}k`;
}

type MockResourcesState = "online" | "offline" | "none";

/** Story helper: the resources row for the active session's machine only, with the ⚙ chooser. */
export function MockResources({
  runner = MOCK_RUNNERS[0],
  state = "online",
  defaultSettingsOpen = false,
}: {
  runner?: MockRunner;
  state?: MockResourcesState;
  defaultSettingsOpen?: boolean;
}) {
  const [kinds, setKinds] = useState<MetricKind[]>(ALL_KINDS);
  const toggle = (kind: MetricKind) => setKinds((current) => (current.includes(kind) ? current.filter((value) => value !== kind) : [...current, kind]));
  const online = state === "online";

  return (
    <CodeChatResources>
      {!online ? <CodeChatResourcesEmpty>{state === "offline" ? "machine offline" : "no machine for this session"}</CodeChatResourcesEmpty> : null}
      {online && kinds.length > 0 ? (
        <CodeChatResourceRunner name={runner.name}>
          {kinds.includes("cpu") ? <CodeChatResourceMetric label="cpu" percent={runner.cpu * 100} value={`${Math.round(runner.cpu * 100)}%`} /> : null}
          {kinds.includes("memory") ? (
            <CodeChatResourceMetric
              label="mem"
              percent={(runner.memory.used / runner.memory.total) * 100}
              value={`${formatBytes(runner.memory.used)}/${formatBytes(runner.memory.total)}`}
            />
          ) : null}
          {kinds.includes("gpu")
            ? runner.gpus.map((gpu) => (
                <CodeChatResourceMetric key={gpu.index} label={`gpu${gpu.index}`} percent={gpu.utilization} value={`${gpu.utilization}% ${gpu.temperature}°`} />
              ))
            : null}
          {kinds.includes("disk")
            ? runner.disks.map((disk) => (
                <CodeChatResourceMetric
                  key={disk.path}
                  label={disk.path}
                  percent={(disk.used / disk.total) * 100}
                  value={`${formatBytes(disk.used)}/${formatBytes(disk.total)}`}
                />
              ))
            : null}
        </CodeChatResourceRunner>
      ) : null}

      <CodeChatResourcesSettings defaultOpen={defaultSettingsOpen}>
        {!online ? (
          <CodeChatResourcesSettingsEmpty>
            {state === "offline" ? "This session's machine is offline." : "This session has no directory, so no machine to show."}
          </CodeChatResourcesSettingsEmpty>
        ) : (
          <CodeChatResourcesSettingsRunner name={runner.name}>
            <CodeChatResourcesSettingsToggle on={kinds.includes("cpu")} onClick={() => toggle("cpu")} icon={<Cpu />} label="cpu" />
            <CodeChatResourcesSettingsToggle on={kinds.includes("memory")} onClick={() => toggle("memory")} icon={<MemoryStick />} label="mem" />
            {runner.gpus.length > 0 ? (
              <CodeChatResourcesSettingsToggle
                on={kinds.includes("gpu")}
                onClick={() => toggle("gpu")}
                icon={<MonitorCog />}
                label={`gpu×${runner.gpus.length}`}
              />
            ) : null}
            {runner.disks.length > 0 ? (
              <CodeChatResourcesSettingsToggle
                on={kinds.includes("disk")}
                onClick={() => toggle("disk")}
                icon={<HardDrive />}
                label={`disk×${runner.disks.length}`}
              />
            ) : null}
          </CodeChatResourcesSettingsRunner>
        )}
      </CodeChatResourcesSettings>
    </CodeChatResources>
  );
}
