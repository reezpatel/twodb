import css from "styled-jsx/css";

export const sidebarStyles = css`
  .code-sidebar {
    display: flex;
    flex-direction: column;
    gap: 20px;
    height: 100%;
    padding: 16px;
    overflow-y: auto;
    background: var(--surface);
  }

  .code-sidebar__section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .code-sidebar__heading {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .code-sidebar__meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin: 0;
    font-size: var(--text-sm);
  }

  .code-sidebar__meta dt {
    color: var(--ink-3);
  }

  .code-sidebar__meta dd {
    margin: 0;
    color: var(--ink);
    overflow-wrap: anywhere;
  }

  .code-sidebar__mono {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm);
  }

  .code-sidebar__empty {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--ink-3);
  }
`;
