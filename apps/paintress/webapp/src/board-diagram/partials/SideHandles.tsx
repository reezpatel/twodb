import { Handle, Position } from "@xyflow/react";

const SIDES = [
  ["t", Position.Top],
  ["r", Position.Right],
  ["b", Position.Bottom],
  ["l", Position.Left],
] as const;

/** Four connection points. Source+target share an id per side; the canvas runs in loose connection mode. */
export function SideHandles() {
  return (
    <>
      {SIDES.map(([id, pos]) => (
        <span key={id}>
          <Handle id={id} type="source" position={pos} className="pa-handle" />
          <Handle id={id} type="target" position={pos} className="pa-handle pa-handle-target" />
        </span>
      ))}
    </>
  );
}
