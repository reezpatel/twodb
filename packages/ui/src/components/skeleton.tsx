import { skeletonStyles } from "./skeleton.style";
export interface SkeletonProps {
  lines?: number;
  width?: number | string;
  height?: number | string;
}

const LINE_WIDTHS = ["100%", "88%", "64%", "76%", "52%"];

export function Skeleton({ lines, width, height = 14 }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: width ?? "100%" }}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="tw-skeleton"
            style={{ height, width: LINE_WIDTHS[i % LINE_WIDTHS.length] }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="tw-skeleton" style={{ height, width: width ?? "100%" }}>
      <style jsx>{skeletonStyles}</style>
    </div>
  );
}
