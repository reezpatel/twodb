import css from "styled-jsx/css";

export const navPanelStyles = css`
  .tw-navpanel {
    display: flex;
    flex-direction: column;
    gap: 2px;
    height: 100%;
    padding: 6px 8px;
    background: var(--surface);
    border-right: 1px solid var(--line);
    overflow-y: auto;
    font-size: var(--text-md);
  }

  .tw-navpanel__search {
    padding: var(--space-3);
    padding-bottom: var(--space-2);
  }
`;
