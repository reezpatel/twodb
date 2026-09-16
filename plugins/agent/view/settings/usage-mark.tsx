import { ScoreRing } from "@twodb/ui";
import type { AgentUsageSnapshotDto } from "../../shared/types";
import { usageMarkStyles } from "./usage-mark.style";

const usageValue = (snapshot: AgentUsageSnapshotDto): string => {
  if (snapshot.unit === "%") return `${snapshot.used.toLocaleString()}%`;
  if (snapshot.unit === "$") {
    return `$${snapshot.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${snapshot.used.toLocaleString()} ${snapshot.unit}`;
};

export const UsageMark = ({
  snapshot,
}: {
  snapshot: AgentUsageSnapshotDto;
}) => {
  const isBalance = snapshot.unit === "$";
  const pct =
    !isBalance && snapshot.total > 0
      ? (snapshot.used / snapshot.total) * 100
      : undefined;
  const tone =
    pct === undefined
      ? undefined
      : pct >= 90
        ? "danger"
        : pct >= 70
          ? "warning"
          : "accent";
  return (
    <span
      className="usage-mark"
      title={`${snapshot.used.toLocaleString()} / ${snapshot.total.toLocaleString()} ${snapshot.unit}`}
    >
      <style jsx>{usageMarkStyles}</style>
      <span className="usage-mark__label">{snapshot.window_type}</span>
      {pct !== undefined && (
        <ScoreRing
          value={pct}
          size={38}
          stroke={3}
          tone={tone}
          label={`${snapshot.window_type} usage ${Math.round(pct)}%`}
        >
          {Math.round(pct)}%
        </ScoreRing>
      )}
      {isBalance && (
        <span className="usage-mark__value tw-tnum">
          {usageValue(snapshot)}
        </span>
      )}
    </span>
  );
};
