import { ReactRenderer, type Editor } from "@tiptap/react";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import type { ComponentType } from "react";

export interface SuggestionListHandle {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

/**
 * Glue between @tiptap/suggestion and a React list component: mounts the
 * list in a floating element positioned at the caret (floating-ui), and
 * forwards keyboard navigation to it.
 */
export function suggestionPopup<P extends { editor: Editor }>(component: ComponentType<P>, toProps: (p: SuggestionProps<any, any>) => P) {
  return () => {
    let renderer: ReactRenderer<SuggestionListHandle, P> | null = null;
    let el: HTMLDivElement | null = null;

    const place = (props: SuggestionProps<any, any>) => {
      const rect = props.clientRect?.();
      if (!el || !rect) return;
      const virtual = { getBoundingClientRect: () => rect };
      void computePosition(virtual, el, { placement: "bottom-start", strategy: "fixed", middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })] }).then(({ x, y }) => {
        if (el) Object.assign(el.style, { left: `${x}px`, top: `${y}px` });
      });
    };

    return {
      onStart: (props: SuggestionProps<any, any>) => {
        el = document.createElement("div");
        el.className = "twodb-suggestion-popup";
        Object.assign(el.style, { position: "fixed", zIndex: "60", left: "0px", top: "0px" });
        document.body.appendChild(el);
        renderer = new ReactRenderer(component as ComponentType<any>, { props: toProps(props), editor: props.editor });
        el.appendChild(renderer.element);
        place(props);
      },
      onUpdate: (props: SuggestionProps<any, any>) => {
        renderer?.updateProps(toProps(props));
        place(props);
      },
      onKeyDown: (props: SuggestionKeyDownProps) => {
        if (props.event.key === "Escape") {
          el?.remove();
          return true;
        }
        return renderer?.ref?.onKeyDown(props.event) ?? false;
      },
      onExit: () => {
        renderer?.destroy();
        el?.remove();
        renderer = null;
        el = null;
      },
    };
  };
}
