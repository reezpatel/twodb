import css from "styled-jsx/css";

export const usageMarkStyles = css`
  .usage-mark {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    white-space: nowrap;
    font-size: var(--text-xs);
    color: var(--ink-3);
  }

  .usage-mark__value {
    color: var(--ink-2);
  }

  .usage-mark__label {
    font-size: var(--text-sm);
    color: var(--ink-1);
    text-transform: capitalize;
  }
`;
