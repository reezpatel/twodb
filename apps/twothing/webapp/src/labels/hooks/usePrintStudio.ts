import { useEffect, useState } from "react";
import { DEFAULT_PRINT, layoutById, perPage, type LabelSpec, type PrintOptions } from "../layouts";

const KEY = "twothing.print";

/**
 * Holding hook for <PrintStudio>: persisted print options, the off-screen
 * #tt-print-root portal target and the matching `@page` rule.
 */
export function usePrintStudio(labels: LabelSpec[]) {
  const [opts, setOpts] = useState<PrintOptions>(() => ({ ...DEFAULT_PRINT, ...JSON.parse(localStorage.getItem(KEY) ?? "{}"), offset: 0 }));
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const layout = layoutById(opts.layoutId);

  const set = <K extends keyof PrintOptions>(k: K, v: PrintOptions[K]) =>
    setOpts((o) => {
      const n = { ...o, [k]: v };
      const { offset: _o, ...persist } = n;
      localStorage.setItem(KEY, JSON.stringify(persist));
      return n;
    });

  useEffect(() => {
    const el = document.createElement("div");
    el.id = "tt-print-root";
    document.body.appendChild(el);
    setRoot(el);
    return () => el.remove();
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `@page { size: ${layout.pageW}mm ${layout.pageH}mm; margin: 0; }`;
    document.head.appendChild(style);
    return () => style.remove();
  }, [layout.pageW, layout.pageH]);

  const total = labels.length * Math.max(1, opts.copies);
  const sheet = perPage(layout) > 1;
  const pages = Math.ceil((total + (sheet ? opts.offset : 0)) / perPage(layout));

  return {
    opts,
    set,
    layout,
    root,
    total,
    pages,
    sheet,
    print: () => window.print(),
  };
}
