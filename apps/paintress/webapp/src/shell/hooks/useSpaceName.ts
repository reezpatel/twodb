import { useCallback } from "react";
import type { Space } from "../../lib/paintress-client";

/** Business hook: space id → display name for group section tooltips. */
export function useSpaceName(spaces: Space[]) {
  return useCallback((spaceId: string) => spaces.find((s) => s.id === spaceId)?.name, [spaces]);
}
