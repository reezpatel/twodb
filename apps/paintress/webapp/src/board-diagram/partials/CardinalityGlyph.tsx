import type { Cardinality } from "@shared/model";

const ANGLE = { right: 0, bottom: 90, left: 180, top: 270 } as const;

/**
 * Crow's-foot end marker. Drawn in a local frame where +x runs along the line,
 * away from the node it is attached to; rotated to the side the line leaves from.
 */
export function CardinalityGlyph(props: { x: number; y: number; side: keyof typeof ANGLE; kind: Cardinality; stroke: string }) {
  const { kind, stroke } = props;
  const foot = kind === "many" || kind === "zero_or_many" || kind === "one_or_many";
  const bar = (x: number) => <line x1={x} y1={-6} x2={x} y2={6} stroke={stroke} strokeWidth={1.6} />;
  return (
    <g transform={`translate(${props.x} ${props.y}) rotate(${ANGLE[props.side]})`} fill="none" pointerEvents="none">
      {foot && (
        <>
          <line x1={14} y1={0} x2={0} y2={-7} stroke={stroke} strokeWidth={1.6} />
          <line x1={14} y1={0} x2={0} y2={7} stroke={stroke} strokeWidth={1.6} />
          <line x1={14} y1={0} x2={0} y2={0} stroke={stroke} strokeWidth={1.6} />
        </>
      )}
      {kind === "one" && (
        <>
          {bar(9)}
          {bar(14)}
        </>
      )}
      {kind === "zero_or_one" && (
        <>
          {bar(9)}
          <circle cx={17} cy={0} r={4} fill="#fff" stroke={stroke} strokeWidth={1.6} />
        </>
      )}
      {kind === "zero_or_many" && <circle cx={20} cy={0} r={4} fill="#fff" stroke={stroke} strokeWidth={1.6} />}
      {kind === "one_or_many" && bar(19)}
    </g>
  );
}
