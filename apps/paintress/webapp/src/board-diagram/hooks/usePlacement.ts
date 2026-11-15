/** What a palette click arms for placement on the canvas. */
export type ArmedSpec =
  | { kind: "shape"; pack: string; shape: string }
  | { kind: "group"; style: string }
  | { kind: "icon"; icon: string; label: string }
  | { kind: "entity" }
  | { kind: "pool" }
  | { kind: "sticky"; color?: string }
  | { kind: "text" };

export interface FlowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const sameSpec = (a: ArmedSpec | null, b: ArmedSpec | null): boolean => JSON.stringify(a) === JSON.stringify(b);
