import { useCallback, useEffect, useRef, useState } from "react";

/** Business hook: one transient message at a time. */
export function useToast(ms = 4500) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback(
    (m: string) => {
      setMessage(m);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), ms);
    },
    [ms],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  return { message, notify, dismiss: () => setMessage(null) };
}
