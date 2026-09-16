import css from "styled-jsx/css";

export const kbdStyles = css`
  /* Kbd — a keycap chip: hairline key with a deepened bottom edge,
   so it reads as a physical key resting on the surface. */

  .tw-kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 6px;
    border: 1px solid var(--line-strong);
    border-bottom-width: 2px;
    border-radius: var(--r-sm);
    background: var(--surface);
    color: var(--ink-2);
    font-family: var(--font-ui);
    font-size: var(--text-xs);
    font-weight: 500;
    line-height: 1;
    letter-spacing: 0.02em;
    user-select: none;
  }

  .tw-kbd :global(svg) {
    width: 12px;
    height: 12px;
  }
`;
