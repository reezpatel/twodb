/* Minimal ambient types for the d3 modules used by knowledge-graph —
   the desktop app installs the runtime packages without @types. */

declare module "d3-force" {
  export interface SimulationNodeDatum {
    index?: number;
    x?: number | null;
    y?: number | null;
    vx?: number | null;
    vy?: number | null;
    fx?: number | null;
    fy?: number | null;
  }

  export interface SimulationLinkDatum<NodeDatum = SimulationNodeDatum> {
    source: NodeDatum | string;
    target: NodeDatum | string;
    index?: number;
  }

  export interface Force<NodeDatum = SimulationNodeDatum> {
    strength(strength: number): Force<NodeDatum>;
    distanceMax(distance: number): Force<NodeDatum>;
    distance(distance: number): Force<NodeDatum>;
    id(idOf: (d: NodeDatum) => string): Force<NodeDatum>;
    radius(radiusOf: (d: NodeDatum) => number): Force<NodeDatum>;
  }

  export interface Simulation<NodeDatum extends SimulationNodeDatum> {
    force(name: string, force?: unknown): Simulation<NodeDatum>;
    alphaDecay(value: number): Simulation<NodeDatum>;
    stop(): Simulation<NodeDatum>;
    tick(): Simulation<NodeDatum>;
  }

  export function forceSimulation<NodeDatum extends SimulationNodeDatum>(nodes: NodeDatum[]): Simulation<NodeDatum>;
  export function forceCenter<NodeDatum extends SimulationNodeDatum>(x: number, y: number): Force<NodeDatum>;
  export function forceManyBody<NodeDatum extends SimulationNodeDatum>(): Force<NodeDatum>;
  export function forceCollide<NodeDatum extends SimulationNodeDatum>(radius: (d: NodeDatum) => number): Force<NodeDatum>;
  export function forceLink<NodeDatum extends SimulationNodeDatum, LinkDatum extends SimulationLinkDatum<NodeDatum>>(links: LinkDatum[]): Force<NodeDatum>;
}

declare module "d3-selection" {
  export interface Selection<DescElement> {
    call(fn: (...args: any[]) => void, ...args: any[]): Selection<DescElement>;
    on(typenames: string, listener: null): Selection<DescElement>;
  }
  export function select<DescElement extends Element>(node: DescElement | string): Selection<DescElement>;
}

declare module "d3-zoom" {
  import type { Selection } from "d3-selection";

  export interface ZoomTransform {
    k: number;
    x: number;
    y: number;
    toString(): string;
  }

  export const zoomIdentity: ZoomTransform;

  export interface ZoomBehavior<ZoomRefElement extends Element, Datum> {
    (selection: Selection<ZoomRefElement>, ...args: unknown[]): void;
    transform: (selection: Selection<ZoomRefElement>, transform: ZoomTransform, ...point: [number, number] | [number, number, number]) => void;
    scaleExtent(extent: [number, number]): ZoomBehavior<ZoomRefElement, Datum>;
    on(typenames: string, listener: (event: { transform: ZoomTransform }) => void): ZoomBehavior<ZoomRefElement, Datum>;
  }

  export function zoom<ZoomRefElement extends Element, Datum>(): ZoomBehavior<ZoomRefElement, Datum>;
}
