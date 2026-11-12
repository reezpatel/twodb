import { useCallback, useEffect, useRef, useState } from "react";

/** Business hook: ids of items an agent just changed, so nodes can pulse briefly. */
export function useAgentActivity(ms = 1800) {
  const [flash, setFlash] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const flashIds = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      setFlash((prev) => new Set([...prev, ...ids]));
      timers.current.push(
        setTimeout(() => {
          setFlash((prev) => {
            const next = new Set(prev);
            ids.forEach((i) => next.delete(i));
            return next;
          });
        }, ms),
      );
    },
    [ms],
  );
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return { flash, flashIds };
}
