import type { NodeTypes } from "@xyflow/react";
import { EntityNode } from "./EntityNode";
import { GroupNode } from "./GroupNode";
import { ImageNode } from "./ImageNode";
import { LaneNode } from "./LaneNode";
import { PoolNode } from "./PoolNode";
import { ShapeNode } from "./ShapeNode";
import { StickyNode } from "./StickyNode";
import { TextNode } from "./TextNode";

/** One React Flow node type per item type. Stable reference (React Flow requires it). */
export const nodeTypes = {
  shape: ShapeNode,
  group: GroupNode,
  pool: PoolNode,
  lane: LaneNode,
  entity: EntityNode,
  sticky: StickyNode,
  text: TextNode,
  image: ImageNode,
} as unknown as NodeTypes;
