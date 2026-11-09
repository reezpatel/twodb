import { useRef } from "react";
import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";

function ImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const width = typeof node.attrs.width === "number" ? node.attrs.width : null;

  const startResize = (event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = width ?? imgRef.current?.getBoundingClientRect().width ?? 320;

    const onMove = (e: PointerEvent) => {
      const next = Math.max(80, Math.round(startWidth + (e.clientX - startX)));
      updateAttributes({ width: next });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <NodeViewWrapper className="note-image" data-selected={selected ? "true" : undefined} style={width ? { width } : undefined}>
      <img ref={imgRef} src={node.attrs.src} alt={node.attrs.alt ?? ""} title={node.attrs.title ?? undefined} draggable={false} />
      <span className="note-image-handle" onPointerDown={startResize} contentEditable={false} title="Drag to resize" />
    </NodeViewWrapper>
  );
}

/** Image with a drag handle that persists width as a node attribute. */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("width");
          const parsed = raw ? Number(raw) : NaN;
          return Number.isFinite(parsed) ? parsed : null;
        },
        renderHTML: (attributes) => (typeof attributes.width === "number" ? { width: attributes.width } : {}),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
