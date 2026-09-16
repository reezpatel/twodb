import css from "styled-jsx/css";

export const agentListStyles = css`
  .agent-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: var(--r-lg);
    overflow: hidden;
  }

  .agent-list li + li .agent-list__row {
    border-top: 1px solid var(--line);
  }

  .agent-list__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    cursor: pointer;
    transition: background var(--dur-1) var(--ease-out);
  }

  .agent-list__row:hover {
    background: var(--bg-band-strong);
  }

  .agent-list__row:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 3px var(--ring);
  }

  .agent-list__row--selected,
  .agent-list__row--selected:hover {
    background: var(--accent-soft-bg);
  }

  .agent-list__title {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: baseline;
    min-width: 0;
  }

  .agent-list__name {
    font-size: var(--text-md);
    font-weight: 500;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .agent-list__provider {
    flex-shrink: 0;
    white-space: nowrap;
    font-size: var(--text-xxs);
  }

  .agent-list__usage {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-shrink: 0;
    font-size: var(--text-xs);
    color: var(--ink-3);
  }

  .agent-list__meta-separator {
    background-color: var(--ink-3);
    height: 18px;
    width: 1px;
    opacity: 0.2;
  }

  .agent-list__meta-error {
    display: inline-block;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--danger-ink);
  }
`;
