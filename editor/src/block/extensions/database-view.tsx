import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import type { BlockEditorHost } from "../types";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    databaseView: {
      insertDatabaseView: (attrs: { databaseId: string; viewId?: string | null }) => ReturnType;
    };
  }
}

function DatabaseViewNode({ node, updateAttributes, deleteNode, editor, extension, selected }: ReactNodeViewProps) {
  const host = (extension.options as { getHost: () => BlockEditorHost }).getHost();
  const Block = host.DatabaseBlock;
  return (
    <NodeViewWrapper className={`twodb-database-block ${selected ? "is-selected" : ""}`} data-drag-handle="">
      {/* stop the editor from treating clicks/keys inside the database UI as document edits */}
      <div contentEditable={false} onKeyDown={(e) => e.stopPropagation()} onPaste={(e) => e.stopPropagation()}>
        {Block ? (
          <Block
            databaseId={node.attrs.databaseId}
            viewId={node.attrs.viewId}
            editable={editor.isEditable}
            setViewId={(viewId) => updateAttributes({ viewId })}
            remove={deleteNode}
          />
        ) : (
          <div className="twodb-database-placeholder">Database {node.attrs.databaseId}</div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

/** Block atom embedding a database view (inline database / linked view). Rendering is the host's job. */
export function createDatabaseView(getHost: () => BlockEditorHost) {
  return Node.create({
    name: "databaseView",
    group: "block",
    atom: true,
    draggable: true,
    selectable: true,
    isolating: true,
    addOptions() {
      return { getHost };
    },
    addAttributes() {
      return {
        databaseId: { default: null, parseHTML: (el) => el.getAttribute("data-database-id") },
        viewId: { default: null, parseHTML: (el) => el.getAttribute("data-view-id") },
      };
    },
    parseHTML() {
      return [{ tag: "div[data-type='database-view']" }];
    },
    renderHTML({ HTMLAttributes, node }) {
      return ["div", mergeAttributes(HTMLAttributes, { "data-type": "database-view", "data-database-id": node.attrs.databaseId, "data-view-id": node.attrs.viewId })];
    },
    addCommands() {
      return {
        insertDatabaseView:
          (attrs) =>
          ({ commands }) =>
            commands.insertContent([{ type: this.name, attrs: { databaseId: attrs.databaseId, viewId: attrs.viewId ?? null } }, { type: "paragraph" }]),
      };
    },
    addNodeView() {
      return ReactNodeViewRenderer(DatabaseViewNode, { stopEvent: ({ event }) => !(event.type === "dragstart" || event.type === "drop") });
    },
  });
}
