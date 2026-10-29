import { SettingsLogs } from "@/components/blocks/settings/logs/settings-logs";
import { useLogs } from "./use-logs";

export function LogsSection() {
  const { entries, total, file, error, loading, levelFilter, setLevelFilter, follow, setFollow } = useLogs();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SettingsLogs
        entries={entries}
        total={total}
        file={file}
        error={error}
        loading={loading}
        levelFilter={levelFilter}
        onLevelFilterChange={setLevelFilter}
        follow={follow}
        onFollowChange={setFollow}
      />
    </div>
  );
}
