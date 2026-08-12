import css from "styled-jsx/css";

export const accountMenuStyles = css`
  .tw-account {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px;
    border-radius: var(--r-md);
    margin-top: var(--space-2);
    transition: background var(--dur-1) var(--ease-out);
  }

  .tw-account:hover {
    background: var(--bg-band);
  }

  .tw-account__meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .tw-account__name {
    font-size: var(--text-md);
    font-weight: 500;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tw-account__sub {
    font-size: var(--text-xs);
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: var(--text-xs);
  }
`;
