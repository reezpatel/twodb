import { memo } from "react";
import { paintressClient } from "../../lib/paintress-client";
import { NodeFrame, type ItemNodeProps } from "./NodeFrame";
import { SideHandles } from "../partials/SideHandles";

function ImageNodeImpl(node: ItemNodeProps) {
  const d = node.data.item.data as { assetId?: string; alt?: string };
  return (
    <NodeFrame node={node} minWidth={40} minHeight={30}>
      {d.assetId && <img src={paintressClient.assetUrl(d.assetId)} alt={d.alt ?? ""} draggable={false} className="absolute inset-0 h-full w-full rounded-sm object-contain" />}
      <SideHandles />
    </NodeFrame>
  );
}

export const ImageNode = memo(ImageNodeImpl);
