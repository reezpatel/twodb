import { Children, isValidElement, useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAppNav } from "./app-nav-context";
import { AppNavLines } from "./app-nav-lines";

/** True when the element, or anything nested in it, carries the given id. */
function containsId(node: ReactNode, id: string | null): boolean {
  if (!id || !isValidElement(node)) return false;
  const props = node.props as { id?: string; children?: ReactNode };
  if (props.id === id) return true;
  return Children.toArray(props.children).some((child) => containsId(child, id));
}

/** A branch-lined group of links / folders. Measures its rows so the lines meet each one. */
export function AppNavList({ children, className, ...props }: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  const [offsets, setOffsets] = useState<number[]>([]);
  const { selectedId, variant, activeColor } = useAppNav();

  const activeIndex = useMemo(
    () =>
      Children.toArray(children)
        .filter(isValidElement)
        .findIndex((child) => containsId(child, selectedId)),
    [children, selectedId],
  );
  const selectedOffset = activeIndex >= 0 && activeIndex < offsets.length ? offsets[activeIndex] : null;

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rows = Array.from(el.children).filter((child) => child.tagName !== "svg") as HTMLElement[];
    setOffsets(rows.map((row) => row.offsetTop + 16));
  }, []);

  const count = Children.count(children);
  useLayoutEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [count, measure]);

  return (
    <div ref={ref} role="group" data-slot="app-nav-list" className={cn("relative flex flex-col gap-0.5", className)} {...props}>
      <AppNavLines offsets={offsets} selectedOffset={selectedOffset} variant={variant} activeColor={activeColor} />
      {children}
    </div>
  );
}
