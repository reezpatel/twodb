import { useFeatureX } from "./hooks/useFeatureX.js";
import { FeatureXEmptyState } from "./partials/FeatureXEmptyState.js";

/**
 * Starter skeleton for TwoLoop's first real feature/pane. Rename this
 * folder and delete this comment once real work starts here. This
 * component only calls its one holding hook and renders partials — see
 * blocks/CONVENTIONS.md for the full convention.
 */
export function FeatureX() {
  const { isEmpty } = useFeatureX();
  return isEmpty ? <FeatureXEmptyState /> : null;
}
