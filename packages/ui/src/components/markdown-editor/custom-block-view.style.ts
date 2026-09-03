import css from "styled-jsx/css";

export const customBlockViewStyles = css`
  .tw-block {
    margin: 0 0 var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--surface);
    overflow: hidden;
  }

  .tw-block__fallback {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    color: var(--ink-3);
    font-size: var(--text-sm);
  }

  .tw-block__badge {
    font-family: var(--font-cue);
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: var(--tracking-cue);
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: var(--r-sm);
    background: var(--bg-band);
    color: var(--ink-2);
  }
`;
