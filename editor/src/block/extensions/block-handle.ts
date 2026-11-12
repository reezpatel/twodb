import { Extension } from "@tiptap/core";
import { NodeSelection, Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

const GRIP_SVG =
  '<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="2.5" cy="3" r="1.4"/><circle cx="7.5" cy="3" r="1.4"/><circle cx="2.5" cy="8" r="1.4"/><circle cx="7.5" cy="8" r="1.4"/><circle cx="2.5" cy="13" r="1.4"/><circle cx="7.5" cy="13" r="1.4"/></svg>';
const PLUS_SVG = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 2v10M2 7h10"/></svg>';

/**
 * Notion/AFFiNE-style block gutter: hovering a top-level block shows "+"
 * (insert below + open the slash menu) and a grip (drag to reorder, click to
 * select the block). Native ProseMirror drag-and-drop does the moving.
 */
export const BlockHandle = Extension.create({
  name: "blockHandle",
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("twodbBlockHandle"),
        view(view: EditorView) {
          const handle = document.createElement("div");
          handle.className = "twodb-block-handle";
          handle.innerHTML = `<button type="button" class="twodb-block-handle-btn" data-act="add" title="Click to add below">${PLUS_SVG}</button><div class="twodb-block-handle-btn" data-act="grip" draggable="true" title="Drag to move · click to select">${GRIP_SVG}</div>`;
          const host = view.dom.parentElement ?? view.dom;
          host.appendChild(handle);
          let current: { pos: number; dom: HTMLElement } | null = null;

          const hide = () => {
            handle.classList.remove("is-visible");
            current = null;
          };

          const blockAt = (y: number) => {
            const rect = view.dom.getBoundingClientRect();
            const found = view.posAtCoords({ left: rect.left + Math.min(40, rect.width / 2), top: y });
            if (!found) return null;
            const $pos = view.state.doc.resolve(found.pos);
            const pos = $pos.depth > 0 ? $pos.before(1) : found.inside >= 0 ? found.inside : null;
            if (pos === null) return null;
            const node = view.state.doc.nodeAt(pos);
            const dom = view.nodeDOM(pos);
            if (!node || !(dom instanceof HTMLElement)) return null;
            return { pos, dom };
          };

          const onMove = (e: MouseEvent) => {
            if (!editor.isEditable || view.dragging) return;
            const rect = view.dom.getBoundingClientRect();
            const inside = e.clientX >= rect.left - 72 && e.clientX <= rect.right + 8 && e.clientY >= rect.top - 4 && e.clientY <= rect.bottom + 4;
            if (!inside) return hide();
            if (handle.contains(e.target as globalThis.Node)) return;
            const b = blockAt(e.clientY);
            if (!b) return hide();
            current = b;
            const hostRect = host.getBoundingClientRect();
            const br = b.dom.getBoundingClientRect();
            const lh = parseFloat(getComputedStyle(b.dom).lineHeight) || 24;
            const top = br.top - hostRect.top + Math.min(lh, br.height) / 2 - 12;
            handle.style.transform = `translate(${rect.left - hostRect.left - 50}px, ${top}px)`;
            handle.classList.add("is-visible");
          };

          const onAdd = (e: MouseEvent) => {
            e.preventDefault();
            if (!current) return;
            const node = view.state.doc.nodeAt(current.pos);
            if (!node) return;
            const empty = node.type.name === "paragraph" && node.content.size === 0;
            let tr = view.state.tr;
            let cursor: number;
            if (empty) cursor = current.pos + 1;
            else {
              const after = current.pos + node.nodeSize;
              tr = tr.insert(after, view.state.schema.nodes.paragraph.create());
              cursor = after + 1;
            }
            tr = tr.setSelection(TextSelection.create(tr.doc, cursor)).insertText("/");
            view.dispatch(tr.scrollIntoView());
            view.focus();
          };

          const onGripClick = () => {
            if (!current) return;
            view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, current.pos)));
            view.focus();
          };

          const onDragStart = (e: DragEvent) => {
            if (!current || !e.dataTransfer) return;
            const sel = NodeSelection.create(view.state.doc, current.pos);
            view.dispatch(view.state.tr.setSelection(sel));
            const slice = sel.content();
            const { dom, text } = view.serializeForClipboard(slice);
            e.dataTransfer.clearData();
            e.dataTransfer.setData("text/html", dom.innerHTML);
            e.dataTransfer.setData("text/plain", text);
            e.dataTransfer.effectAllowed = "copyMove";
            e.dataTransfer.setDragImage(current.dom, 0, 0);
            view.dragging = { slice, move: true };
            handle.classList.remove("is-visible");
          };

          const add = handle.querySelector<HTMLElement>('[data-act="add"]')!;
          const grip = handle.querySelector<HTMLElement>('[data-act="grip"]')!;
          add.addEventListener("mousedown", onAdd);
          grip.addEventListener("click", onGripClick);
          grip.addEventListener("dragstart", onDragStart);
          document.addEventListener("mousemove", onMove);
          view.dom.addEventListener("keydown", hide);

          return {
            destroy() {
              document.removeEventListener("mousemove", onMove);
              view.dom.removeEventListener("keydown", hide);
              handle.remove();
            },
          };
        },
      }),
    ];
  },
});
